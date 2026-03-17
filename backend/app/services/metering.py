"""
Usage-based metering service. Tracks every MCP tool call,
calculates costs, splits revenue 70/30 (provider/platform).
"""

import time
import json
from sqlalchemy.orm import Session
from app.models.schemas import Transaction, Provider, Consumer, MCPTool
from app.models.pydantic_models import PayoutSimulation, PayoutSimulationRequest


PLATFORM_FEE_RATE = 0.30  # 30% platform take
PROVIDER_RATE = 0.70  # 70% to provider


def record_transaction(
    db: Session,
    provider_id: int,
    consumer_id: int,
    tool_name: str,
    cost: float,
    latency_ms: float,
) -> Transaction:
    provider_payout = round(cost * PROVIDER_RATE, 4)
    platform_fee = round(cost * PLATFORM_FEE_RATE, 4)

    txn = Transaction(
        provider_id=provider_id,
        consumer_id=consumer_id,
        tool_name=tool_name,
        cost=cost,
        provider_payout=provider_payout,
        platform_fee=platform_fee,
        latency_ms=latency_ms,
        status="completed",
    )
    db.add(txn)

    # Update provider earnings
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if provider:
        provider.total_earnings += provider_payout

    # Update consumer spend
    consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()
    if consumer:
        consumer.total_spent += cost
        consumer.query_count += 1

    # Update tool call count
    tool = db.query(MCPTool).filter(MCPTool.name == tool_name).first()
    if tool:
        tool.call_count += 1
        # Running average for latency
        tool.avg_latency_ms = round(
            (tool.avg_latency_ms * (tool.call_count - 1) + latency_ms) / tool.call_count, 1
        )

    db.commit()
    db.refresh(txn)
    return txn


def simulate_payout(req: PayoutSimulationRequest) -> PayoutSimulation:
    """Simulate monthly payout with performance bonuses."""
    gross_revenue = req.monthly_queries * req.price_per_call
    base_payout = gross_revenue * PROVIDER_RATE

    # Uptime bonus: up to 5% extra for 99.5%+ uptime
    uptime_bonus = 0.0
    if req.uptime_score >= 99.9:
        uptime_bonus = base_payout * 0.05
    elif req.uptime_score >= 99.5:
        uptime_bonus = base_payout * 0.03
    elif req.uptime_score >= 99.0:
        uptime_bonus = base_payout * 0.01

    # Quality bonus: up to 5% extra for high quality scores
    quality_bonus = 0.0
    if req.quality_score >= 98.0:
        quality_bonus = base_payout * 0.05
    elif req.quality_score >= 95.0:
        quality_bonus = base_payout * 0.03
    elif req.quality_score >= 90.0:
        quality_bonus = base_payout * 0.01

    # Volume bonus: tiered based on monthly queries
    volume_bonus = 0.0
    if req.monthly_queries >= 100000:
        volume_bonus = base_payout * 0.08
    elif req.monthly_queries >= 50000:
        volume_bonus = base_payout * 0.05
    elif req.monthly_queries >= 10000:
        volume_bonus = base_payout * 0.02

    # Freshness bonus: flat 2% (assume data is fresh in simulation)
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
