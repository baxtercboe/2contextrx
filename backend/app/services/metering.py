"""
Advanced usage-based metering service.

Consumer cost formula:
  cost = base_price × complexity_multiplier × volume_multiplier

Complexity multiplier (1.0–2.5x):
  Based on number of parameters and presence of optional enrichments.

Volume multiplier (discount for high-volume consumers):
  1–100 queries:    1.00x
  101–1000:         0.95x
  1001–10000:       0.90x
  10001+:           0.85x

Provider reward formula:
  provider_payout = (cost × 0.70) + uptime_bonus + quality_bonus

Uptime bonus:   cost × 0.03  if uptime >= 99.5%
Quality bonus:  cost × 0.02  if quality >= 95.0%
"""

import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.schemas import Transaction, Provider, Consumer, MCPTool
from app.models.pydantic_models import (
    PayoutSimulation, PayoutSimulationRequest,
    CostBreakdown, RewardBreakdown,
)


PLATFORM_BASE_RATE = 0.70  # 70% to provider
UPTIME_BONUS_THRESHOLD = 99.5
UPTIME_BONUS_RATE = 0.03
QUALITY_BONUS_THRESHOLD = 95.0
QUALITY_BONUS_RATE = 0.02


def calculate_complexity_multiplier(parameters: dict) -> float:
    """
    Complexity scales with the number and depth of parameters.
      0-1 params  → 1.0x
      2 params    → 1.2x
      3 params    → 1.5x
      4+ params   → 1.8x
    Nested objects add +0.3x each (capped at 2.5x).
    """
    n_params = len(parameters)
    base = 1.0
    if n_params >= 4:
        base = 1.8
    elif n_params == 3:
        base = 1.5
    elif n_params == 2:
        base = 1.2

    # Detect nested complexity
    nested = sum(1 for v in parameters.values() if isinstance(v, (dict, list)))
    base += nested * 0.3

    return round(min(base, 2.5), 2)


def calculate_volume_multiplier(consumer_query_count: int) -> float:
    """Volume discount — rewards heavy consumers."""
    if consumer_query_count >= 10000:
        return 0.85
    elif consumer_query_count >= 1000:
        return 0.90
    elif consumer_query_count >= 100:
        return 0.95
    return 1.00


def compute_cost(
    base_price: float,
    parameters: dict,
    consumer_query_count: int,
) -> CostBreakdown:
    """Full consumer-side cost calculation with math breakdown."""
    complexity = calculate_complexity_multiplier(parameters)
    volume = calculate_volume_multiplier(consumer_query_count)
    final_cost = round(base_price * complexity * volume, 4)

    return CostBreakdown(
        base_cost=base_price,
        complexity_multiplier=complexity,
        volume_multiplier=volume,
        final_cost=final_cost,
        formula=f"${base_price:.4f} × {complexity}x (complexity) × {volume}x (volume) = ${final_cost:.4f}",
    )


def compute_reward(
    cost: float,
    provider_uptime: float,
    provider_quality: float,
) -> RewardBreakdown:
    """Full provider-side reward calculation with bonus math."""
    base_payout = round(cost * PLATFORM_BASE_RATE, 4)

    uptime_bonus = 0.0
    if provider_uptime >= UPTIME_BONUS_THRESHOLD:
        uptime_bonus = round(cost * UPTIME_BONUS_RATE, 4)

    quality_bonus = 0.0
    if provider_quality >= QUALITY_BONUS_THRESHOLD:
        quality_bonus = round(cost * QUALITY_BONUS_RATE, 4)

    total_payout = round(base_payout + uptime_bonus + quality_bonus, 4)
    platform_fee = round(cost - total_payout, 4)

    parts = [f"${cost:.4f} × 0.70 = ${base_payout:.4f}"]
    if uptime_bonus > 0:
        parts.append(f"+ ${uptime_bonus:.4f} uptime bonus (≥{UPTIME_BONUS_THRESHOLD}%)")
    if quality_bonus > 0:
        parts.append(f"+ ${quality_bonus:.4f} quality bonus (≥{QUALITY_BONUS_THRESHOLD}%)")
    parts.append(f"= ${total_payout:.4f} provider | ${platform_fee:.4f} platform")

    return RewardBreakdown(
        provider_base_payout=base_payout,
        uptime_bonus=uptime_bonus,
        quality_bonus=quality_bonus,
        total_provider_payout=total_payout,
        platform_fee=platform_fee,
        formula=" ".join(parts),
    )


def record_transaction(
    db: Session,
    provider_id: int,
    consumer_id: int,
    tool_name: str,
    parameters: dict,
    latency_ms: float,
    session_id: str | None = None,
    routed_to_endpoint: str | None = None,
) -> tuple[Transaction, CostBreakdown, RewardBreakdown]:
    """Record a metered transaction with full cost/reward math."""

    # Look up the tool, provider, consumer
    tool = db.query(MCPTool).filter(MCPTool.name == tool_name).first()
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()

    if not tool or not provider or not consumer:
        raise ValueError("Invalid tool, provider, or consumer reference")

    # --- Cost calculation ---
    cost_bd = compute_cost(
        base_price=tool.price_per_call,
        parameters=parameters,
        consumer_query_count=consumer.query_count,
    )

    # --- Reward calculation ---
    reward_bd = compute_reward(
        cost=cost_bd.final_cost,
        provider_uptime=provider.uptime_score,
        provider_quality=provider.quality_score,
    )

    # --- Persist ---
    txn = Transaction(
        provider_id=provider_id,
        consumer_id=consumer_id,
        tool_name=tool_name,
        session_id=session_id,
        base_cost=cost_bd.base_cost,
        complexity_multiplier=cost_bd.complexity_multiplier,
        volume_multiplier=cost_bd.volume_multiplier,
        cost=cost_bd.final_cost,
        provider_base_payout=reward_bd.provider_base_payout,
        uptime_bonus=reward_bd.uptime_bonus,
        quality_bonus=reward_bd.quality_bonus,
        provider_payout=reward_bd.total_provider_payout,
        platform_fee=reward_bd.platform_fee,
        latency_ms=latency_ms,
        routed_to_endpoint=routed_to_endpoint,
        status="completed",
    )
    db.add(txn)

    # Update running totals
    provider.total_earnings += reward_bd.total_provider_payout
    consumer.total_spent += cost_bd.final_cost
    consumer.query_count += 1

    # Update tool stats
    tool.call_count += 1
    tool.avg_latency_ms = round(
        (tool.avg_latency_ms * (tool.call_count - 1) + latency_ms) / tool.call_count, 1
    )

    db.commit()
    db.refresh(txn)
    return txn, cost_bd, reward_bd


def simulate_payout(req: PayoutSimulationRequest) -> PayoutSimulation:
    """Simulate monthly payout with performance bonuses."""
    gross_revenue = req.monthly_queries * req.price_per_call
    base_payout = gross_revenue * PLATFORM_BASE_RATE

    uptime_bonus = 0.0
    if req.uptime_score >= 99.9:
        uptime_bonus = base_payout * 0.05
    elif req.uptime_score >= 99.5:
        uptime_bonus = base_payout * 0.03
    elif req.uptime_score >= 99.0:
        uptime_bonus = base_payout * 0.01

    quality_bonus = 0.0
    if req.quality_score >= 98.0:
        quality_bonus = base_payout * 0.05
    elif req.quality_score >= 95.0:
        quality_bonus = base_payout * 0.03
    elif req.quality_score >= 90.0:
        quality_bonus = base_payout * 0.01

    volume_bonus = 0.0
    if req.monthly_queries >= 100000:
        volume_bonus = base_payout * 0.08
    elif req.monthly_queries >= 50000:
        volume_bonus = base_payout * 0.05
    elif req.monthly_queries >= 10000:
        volume_bonus = base_payout * 0.02

    freshness_bonus = base_payout * 0.02

    total_payout = base_payout + uptime_bonus + quality_bonus + volume_bonus + freshness_bonus
    platform_fee = gross_revenue - total_payout

    return PayoutSimulation(
        base_payout=round(base_payout, 2),
        uptime_bonus=round(uptime_bonus, 2),
        quality_bonus=round(quality_bonus, 2),
        volume_bonus=round(volume_bonus, 2),
        freshness_bonus=round(freshness_bonus, 2),
        total_payout=round(total_payout, 2),
        platform_fee=round(platform_fee, 2),
    )
