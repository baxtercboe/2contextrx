"""
ContextRx Autonomy Agent — LangChain-style tool-calling agent.

Implements a ReAct-style agent loop with 4 tools:
  1. onboard_mock_provider() — creates new provider with realistic data
  2. adjust_bonus(provider_id, reason) — adjusts bonus % based on performance
  3. adjust_platform_take(new_rate) — changes global take rate (25–35%)
  4. generate_monthly_report() — summarizes revenue, top providers, suggestions

Each cycle the agent "thinks" (structured reasoning), selects tools,
executes them, observes results, and decides on next actions.
Reasoning is streamed to the log for full transparency.
"""

import json
import random
import secrets
from datetime import datetime, timezone
from typing import Any
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.schemas import (
    Provider, Consumer, MCPTool, Transaction, AutonomyLog, PlatformMetrics,
)
from app.mcp.mock_servers import MCP_TOOL_CATALOG


# ─── Global State ────────────────────────────────────────────────────────────

_cycle_counter = 0
_platform_take_rate = 0.30  # 30% default, adjustable 25–35%


def get_platform_take_rate() -> float:
    return _platform_take_rate


def set_platform_take_rate(rate: float):
    global _platform_take_rate
    _platform_take_rate = max(0.25, min(0.35, rate))


# ─── Mock Org Data ───────────────────────────────────────────────────────────

MOCK_ORGS = [
    ("Aetna Claims Analytics", "aetna-mcp.contextrx.io"),
    ("Cigna Population Health", "cigna-mcp.contextrx.io"),
    ("Humana Data Exchange", "humana-mcp.contextrx.io"),
    ("Kaiser Permanente Insights", "kaiser-mcp.contextrx.io"),
    ("UnitedHealth Data Cloud", "uhc-mcp.contextrx.io"),
    ("Anthem Regional Analytics", "anthem-mcp.contextrx.io"),
    ("Centene Community Data", "centene-mcp.contextrx.io"),
    ("Molina Healthcare Metrics", "molina-mcp.contextrx.io"),
    ("Oscar Health Intelligence", "oscar-mcp.contextrx.io"),
    ("Elevance Data Services", "elevance-mcp.contextrx.io"),
    ("Highmark Analytics Hub", "highmark-mcp.contextrx.io"),
    ("WellCare Insights Platform", "wellcare-mcp.contextrx.io"),
]

BONUS_REASONS = {
    "excellent_uptime": ("Sustained uptime >99.5%", +0.03),
    "high_quality": ("Quality score exceeds 96", +0.02),
    "volume_leader": ("Top query volume this period", +0.05),
    "data_freshness": ("Consistent sub-24h data refresh", +0.02),
    "declining_uptime": ("Uptime dropped below 97%", -0.02),
    "quality_concern": ("Quality score slipped below 92", -0.01),
    "low_volume": ("Query volume below threshold", -0.01),
}


# ─── Agent Thought / Action / Observation Dataclasses ────────────────────────

@dataclass
class AgentThought:
    """A single reasoning step in the agent's chain-of-thought."""
    step: int
    thought: str
    tool: str | None = None
    tool_input: dict = field(default_factory=dict)
    observation: str = ""
    action_taken: str = ""
    impact: str = "neutral"
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class AgentCycleResult:
    """Full result of one agent cycle."""
    cycle_number: int
    thoughts: list[AgentThought]
    actions_taken: int
    platform_take_rate: float
    summary: str
    started_at: str
    completed_at: str = ""


# ─── Agent Tools ─────────────────────────────────────────────────────────────

def tool_onboard_mock_provider(db: Session, **kwargs) -> dict:
    """
    Tool: onboard_mock_provider
    Creates a new provider entry with realistic healthcare org data,
    assigns 2-3 MCP tools, and activates them immediately.
    """
    existing = db.query(Provider).count()
    org_name, endpoint = MOCK_ORGS[existing % len(MOCK_ORGS)]

    # Add suffix if we've cycled through all orgs
    suffix = f" v{existing // len(MOCK_ORGS) + 1}" if existing >= len(MOCK_ORGS) else ""
    org_name = f"{org_name}{suffix}"

    api_key = f"crx_prov_{secrets.token_hex(16)}"
    uptime = round(random.uniform(96.5, 99.9), 1)
    quality = round(random.uniform(90.0, 99.0), 1)

    provider = Provider(
        name=f"{org_name} MCP Server",
        organization=org_name,
        mcp_endpoint=f"https://{endpoint}/v1/mcp",
        api_key=api_key,
        status="active",
        data_domains=json.dumps(random.sample(
            ["claims", "pharmacy", "utilization", "population_health", "cost_trends", "risk_scores"],
            k=random.randint(2, 4),
        )),
        uptime_score=uptime,
        quality_score=quality,
    )
    db.add(provider)
    db.flush()

    tools_to_add = random.sample(MCP_TOOL_CATALOG, k=min(random.randint(2, 3), len(MCP_TOOL_CATALOG)))
    for tool_def in tools_to_add:
        tool = MCPTool(
            provider_id=provider.id,
            name=tool_def["name"],
            description=tool_def["description"],
            input_schema=tool_def["input_schema"],
            price_per_call=tool_def["price_per_call"],
            category=tool_def["category"],
        )
        db.add(tool)

    return {
        "status": "success",
        "provider_id": provider.id,
        "organization": org_name,
        "endpoint": endpoint,
        "tools_added": len(tools_to_add),
        "uptime_score": uptime,
        "quality_score": quality,
        "domains": json.loads(provider.data_domains),
    }


def tool_adjust_bonus(db: Session, provider_id: int = 0, reason: str = "") -> dict:
    """
    Tool: adjust_bonus
    Adjusts a provider's bonus multiplier based on performance metrics.
    Modifies uptime_score and quality_score to reflect bonus changes.
    """
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        return {"status": "error", "message": f"Provider {provider_id} not found"}

    reason_key = reason if reason in BONUS_REASONS else random.choice(list(BONUS_REASONS.keys()))
    reason_desc, delta = BONUS_REASONS[reason_key]

    old_uptime = provider.uptime_score
    old_quality = provider.quality_score

    if delta > 0:
        # Positive bonus: boost scores slightly
        provider.uptime_score = round(min(100.0, old_uptime + random.uniform(0.1, 0.5)), 1)
        provider.quality_score = round(min(100.0, old_quality + random.uniform(0.2, 0.8)), 1)
    else:
        # Negative: reduce scores
        provider.uptime_score = round(max(90.0, old_uptime + random.uniform(-0.5, -0.1)), 1)
        provider.quality_score = round(max(85.0, old_quality + random.uniform(-0.8, -0.2)), 1)

    # Calculate effective bonus rate for display
    bonus_rate = round(abs(delta) * 100, 1)
    direction = "increased" if delta > 0 else "decreased"

    return {
        "status": "success",
        "provider_id": provider_id,
        "organization": provider.organization,
        "reason": reason_desc,
        "bonus_change": f"{'+' if delta > 0 else ''}{delta*100:.1f}%",
        "direction": direction,
        "bonus_rate_pct": bonus_rate,
        "uptime": {"old": old_uptime, "new": provider.uptime_score},
        "quality": {"old": old_quality, "new": provider.quality_score},
    }


def tool_adjust_platform_take(db: Session, new_rate: float = 0.30) -> dict:
    """
    Tool: adjust_platform_take
    Changes the global platform take rate (25–35%).
    Lower rates attract more volume; higher rates increase per-txn revenue.
    """
    old_rate = get_platform_take_rate()
    set_platform_take_rate(new_rate)
    actual_new = get_platform_take_rate()

    total_revenue = db.query(func.sum(Transaction.cost)).scalar() or 0.0
    total_txns = db.query(Transaction).count()
    projected_platform_rev = float(total_revenue) * actual_new

    return {
        "status": "success",
        "old_rate": round(old_rate * 100, 1),
        "new_rate": round(actual_new * 100, 1),
        "direction": "decreased" if actual_new < old_rate else ("increased" if actual_new > old_rate else "unchanged"),
        "reason": _take_rate_reasoning(old_rate, actual_new, total_txns),
        "projected_platform_revenue": round(projected_platform_rev, 2),
        "total_transactions": total_txns,
    }


def _take_rate_reasoning(old: float, new: float, txns: int) -> str:
    if new < old:
        return f"Reducing take rate to stimulate marketplace volume (currently {txns} txns). Lower fees attract more consumers."
    elif new > old:
        return f"Increasing take rate to improve platform sustainability. Current volume ({txns} txns) supports higher margin."
    return "Take rate unchanged — current balance is optimal."


def tool_generate_monthly_report(db: Session, **kwargs) -> dict:
    """
    Tool: generate_monthly_report
    Generates a comprehensive monthly summary with revenue analysis,
    top providers, marketplace health, and strategic suggestions.
    """
    total_providers = db.query(Provider).count()
    active_providers = db.query(Provider).filter(Provider.status == "active").count()
    total_consumers = db.query(Consumer).count()
    total_txns = db.query(Transaction).count()
    total_revenue = float(db.query(func.sum(Transaction.cost)).scalar() or 0.0)
    total_provider_payouts = float(db.query(func.sum(Transaction.provider_payout)).scalar() or 0.0)
    total_platform_fees = float(db.query(func.sum(Transaction.platform_fee)).scalar() or 0.0)
    avg_latency = float(db.query(func.avg(Transaction.latency_ms)).scalar() or 0.0)

    # Top providers by earnings
    top_providers = (
        db.query(
            Provider.organization,
            func.sum(Transaction.provider_payout).label("earnings"),
            func.count(Transaction.id).label("txn_count"),
        )
        .join(Transaction)
        .group_by(Provider.organization)
        .order_by(func.sum(Transaction.provider_payout).desc())
        .limit(5)
        .all()
    )

    # Top tools by usage
    top_tools = (
        db.query(
            Transaction.tool_name,
            func.count(Transaction.id).label("usage"),
            func.sum(Transaction.cost).label("revenue"),
        )
        .group_by(Transaction.tool_name)
        .order_by(func.count(Transaction.id).desc())
        .limit(5)
        .all()
    )

    take_rate = get_platform_take_rate()
    avg_uptime = float(db.query(func.avg(Provider.uptime_score)).scalar() or 0.0)
    avg_quality = float(db.query(func.avg(Provider.quality_score)).scalar() or 0.0)

    # Generate strategic suggestions
    suggestions = []
    if active_providers < 5:
        suggestions.append("Priority: Onboard more providers to increase catalog diversity")
    if total_txns < 50:
        suggestions.append("Volume is low — consider reducing take rate to attract consumers")
    if avg_uptime < 98:
        suggestions.append("Average uptime below 98% — investigate underperforming providers")
    if avg_quality > 96:
        suggestions.append("Quality is excellent — consider premium tier pricing")
    if take_rate > 0.30 and total_txns < 100:
        suggestions.append("Take rate may be too high for current volume — consider reduction")
    if not suggestions:
        suggestions.append("Marketplace is healthy — maintain current strategy")
        suggestions.append("Consider expanding to new data domains (genomics, social determinants)")

    return {
        "status": "success",
        "report": {
            "period": datetime.now(timezone.utc).strftime("%B %Y"),
            "marketplace": {
                "total_providers": total_providers,
                "active_providers": active_providers,
                "total_consumers": total_consumers,
                "total_transactions": total_txns,
            },
            "financials": {
                "total_revenue": round(total_revenue, 2),
                "provider_payouts": round(total_provider_payouts, 2),
                "platform_fees": round(total_platform_fees, 2),
                "platform_take_rate": f"{take_rate*100:.1f}%",
                "avg_transaction_value": round(total_revenue / max(total_txns, 1), 4),
            },
            "performance": {
                "avg_latency_ms": round(avg_latency, 1),
                "avg_uptime": round(avg_uptime, 1),
                "avg_quality": round(avg_quality, 1),
            },
            "top_providers": [
                {"organization": p[0], "earnings": round(float(p[1]), 2), "transactions": p[2]}
                for p in top_providers
            ],
            "top_tools": [
                {"tool": t[0], "usage": t[1], "revenue": round(float(t[2]), 2)}
                for t in top_tools
            ],
            "suggestions": suggestions,
        },
    }


# ─── Agent Tool Registry ────────────────────────────────────────────────────

AGENT_TOOLS = {
    "onboard_mock_provider": {
        "fn": tool_onboard_mock_provider,
        "description": "Creates a new healthcare data provider with realistic org data, MCP endpoint, and 2-3 tools",
        "parameters": [],
    },
    "adjust_bonus": {
        "fn": tool_adjust_bonus,
        "description": "Adjusts a provider's performance bonus based on uptime, quality, or volume metrics",
        "parameters": ["provider_id", "reason"],
    },
    "adjust_platform_take": {
        "fn": tool_adjust_platform_take,
        "description": "Changes the global platform take rate (25-35%) to optimize marketplace economics",
        "parameters": ["new_rate"],
    },
    "generate_monthly_report": {
        "fn": tool_generate_monthly_report,
        "description": "Generates comprehensive monthly report with revenue, top providers, and strategic suggestions",
        "parameters": [],
    },
}


# ─── ReAct Agent Loop ────────────────────────────────────────────────────────

# Simulated LLM reasoning templates — these mimic what a real LLM agent would produce
REASONING_TEMPLATES = {
    "onboard_assessment": [
        "Analyzing marketplace supply... Currently {provider_count} providers in the network. "
        "Target density is 8-12 providers for healthy competition. {gap_analysis}",
        "Evaluating provider diversity... Current domains: {domains}. "
        "Healthcare data buyers need access to claims, pharmacy, population health, and cost data. "
        "I should onboard a new provider to fill gaps.",
        "Supply-side analysis: {provider_count} providers serving {consumer_count} consumers. "
        "Ratio of {ratio:.1f} providers per consumer. Optimal range is 2-4x. {recommendation}",
    ],
    "bonus_assessment": [
        "Reviewing performance metrics for {org}... "
        "Uptime: {uptime}% (threshold: 99%), Quality: {quality}% (threshold: 95%). {verdict}",
        "Provider {org} has processed {txn_count} queries with {uptime}% uptime. "
        "Comparing against network average of {avg_uptime}%. {verdict}",
        "Evaluating {org} for bonus adjustment... "
        "Quality score {quality}% is {quality_vs} network average. "
        "This provider {earnings_status}. {verdict}",
    ],
    "take_rate_assessment": [
        "Analyzing marketplace economics... Current take rate: {rate}%. "
        "Total volume: {txns} transactions generating ${revenue:.2f} in revenue. {analysis}",
        "Platform sustainability check: Take rate at {rate}%, "
        "platform earnings ${platform_earnings:.2f}. "
        "Provider satisfaction requires competitive splits. {analysis}",
    ],
    "report_assessment": [
        "Time to generate insights... Cycle #{cycle} — aggregating marketplace-wide metrics "
        "for strategic decision-making. This will cover financials, performance, and growth.",
        "Running monthly analysis on {provider_count} providers, {consumer_count} consumers, "
        "and ${revenue:.2f} in total revenue. Generating actionable recommendations.",
    ],
}


def _simulate_reasoning(template_key: str, **kwargs) -> str:
    """Pick a random reasoning template and fill it with context."""
    templates = REASONING_TEMPLATES.get(template_key, ["Analyzing current state..."])
    return random.choice(templates).format(**kwargs)


def _gather_context(db: Session) -> dict:
    """Gather all context the agent needs to make decisions."""
    providers = db.query(Provider).all()
    active_providers = [p for p in providers if p.status == "active"]
    consumers = db.query(Consumer).all()
    total_txns = db.query(Transaction).count()
    total_revenue = float(db.query(func.sum(Transaction.cost)).scalar() or 0.0)
    platform_earnings = float(db.query(func.sum(Transaction.platform_fee)).scalar() or 0.0)
    avg_uptime = float(db.query(func.avg(Provider.uptime_score)).scalar() or 0.0) if providers else 99.0
    avg_quality = float(db.query(func.avg(Provider.quality_score)).scalar() or 0.0) if providers else 95.0

    # Per-provider transaction counts
    provider_txn_counts = {}
    for p in providers:
        count = db.query(Transaction).filter(Transaction.provider_id == p.id).count()
        provider_txn_counts[p.id] = count

    domains = set()
    for p in providers:
        try:
            domains.update(json.loads(p.data_domains))
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "providers": providers,
        "active_providers": active_providers,
        "consumers": consumers,
        "provider_count": len(providers),
        "active_count": len(active_providers),
        "consumer_count": len(consumers),
        "total_txns": total_txns,
        "total_revenue": total_revenue,
        "platform_earnings": platform_earnings,
        "avg_uptime": avg_uptime,
        "avg_quality": avg_quality,
        "provider_txn_counts": provider_txn_counts,
        "domains": ", ".join(sorted(domains)) if domains else "none",
        "take_rate": get_platform_take_rate(),
    }


def run_autonomy_cycle(db: Session) -> dict:
    """
    Run one full ReAct-style agent cycle.
    Returns structured result with thoughts, actions, and observations.
    """
    global _cycle_counter
    _cycle_counter += 1
    cycle = _cycle_counter

    started_at = datetime.now(timezone.utc).isoformat()
    ctx = _gather_context(db)
    thoughts: list[dict] = []
    step = 0

    # ── Step 1: Assess supply — should we onboard? ──────────────────────

    step += 1
    gap_analysis = (
        "Gap detected — need more providers for healthy marketplace."
        if ctx["provider_count"] < 10
        else "Provider supply is adequate for current demand."
    )
    ratio = ctx["provider_count"] / max(ctx["consumer_count"], 1)
    recommendation = (
        "Recommendation: Onboard a new provider."
        if ratio < 3.0
        else "Supply is sufficient — skip onboarding this cycle."
    )

    thought_text = _simulate_reasoning(
        "onboard_assessment",
        provider_count=ctx["provider_count"],
        consumer_count=ctx["consumer_count"],
        gap_analysis=gap_analysis,
        domains=ctx["domains"],
        ratio=ratio,
        recommendation=recommendation,
    )

    should_onboard = ctx["provider_count"] < 10 or (ratio < 3.0 and random.random() < 0.7)

    thought = {
        "step": step,
        "thought": thought_text,
        "tool": "onboard_mock_provider" if should_onboard else None,
        "tool_input": {},
        "observation": "",
        "action_taken": "",
        "impact": "neutral",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if should_onboard:
        result = tool_onboard_mock_provider(db)
        thought["observation"] = (
            f"Successfully onboarded '{result['organization']}' (ID: {result['provider_id']}) "
            f"with {result['tools_added']} MCP tools. "
            f"Domains: {', '.join(result['domains'])}. "
            f"Uptime: {result['uptime_score']}%, Quality: {result['quality_score']}%"
        )
        thought["action_taken"] = (
            f"Onboarded new provider: {result['organization']} → "
            f"{result['tools_added']} tools, uptime {result['uptime_score']}%"
        )
        thought["impact"] = "positive"

        _log_action(db, cycle, "provider_onboard", thought["action_taken"],
                    json.dumps(result), "positive")
    else:
        thought["observation"] = f"Supply is adequate ({ctx['provider_count']} providers). Skipping onboarding."
        thought["action_taken"] = "No onboarding needed this cycle"

    thoughts.append(thought)

    # ── Step 2: Evaluate provider bonuses ────────────────────────────────

    if ctx["active_providers"]:
        # Pick 1-2 providers to evaluate
        providers_to_eval = random.sample(
            ctx["active_providers"],
            k=min(random.randint(1, 2), len(ctx["active_providers"])),
        )

        for provider in providers_to_eval:
            step += 1
            txn_count = ctx["provider_txn_counts"].get(provider.id, 0)
            quality_vs = "above" if provider.quality_score > ctx["avg_quality"] else "below"
            earnings_status = (
                f"has earned ${provider.total_earnings:.2f}"
                if provider.total_earnings > 0
                else "is newly onboarded"
            )

            # Determine bonus direction
            if provider.uptime_score >= 99.5:
                reason = "excellent_uptime"
                verdict = "Excellent uptime performance → awarding bonus"
            elif provider.quality_score >= 96:
                reason = "high_quality"
                verdict = "High quality scores → awarding quality bonus"
            elif txn_count > 5:
                reason = "volume_leader"
                verdict = "Strong query volume → awarding volume bonus"
            elif provider.uptime_score < 97:
                reason = "declining_uptime"
                verdict = "Uptime below threshold → applying penalty adjustment"
            elif provider.quality_score < 92:
                reason = "quality_concern"
                verdict = "Quality needs improvement → minor adjustment"
            else:
                reason = random.choice(["data_freshness", "excellent_uptime", "high_quality"])
                verdict = f"Metrics within normal range → applying standard {reason.replace('_', ' ')} adjustment"

            thought_text = _simulate_reasoning(
                "bonus_assessment",
                org=provider.organization,
                uptime=provider.uptime_score,
                quality=provider.quality_score,
                txn_count=txn_count,
                avg_uptime=round(ctx["avg_uptime"], 1),
                quality_vs=quality_vs,
                earnings_status=earnings_status,
                verdict=verdict,
            )

            result = tool_adjust_bonus(db, provider_id=provider.id, reason=reason)

            thought = {
                "step": step,
                "thought": thought_text,
                "tool": "adjust_bonus",
                "tool_input": {"provider_id": provider.id, "reason": reason},
                "observation": (
                    f"Adjusted bonus for {result['organization']}: {result['bonus_change']} "
                    f"({result['reason']}). "
                    f"Uptime: {result['uptime']['old']}→{result['uptime']['new']}%, "
                    f"Quality: {result['quality']['old']}→{result['quality']['new']}%"
                ),
                "action_taken": (
                    f"Bonus {result['direction']} for {result['organization']}: "
                    f"{result['bonus_change']} — {result['reason']}"
                ),
                "impact": "positive" if result["direction"] == "increased" else "negative",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            _log_action(db, cycle, "bonus_adjustment", thought["action_taken"],
                        json.dumps(result), thought["impact"])
            thoughts.append(thought)

    # ── Step 3: Evaluate platform take rate ──────────────────────────────

    step += 1
    current_rate = ctx["take_rate"]
    rate_pct = current_rate * 100

    # Decide on rate adjustment
    if ctx["total_txns"] < 30 and current_rate > 0.27:
        new_rate = round(current_rate - random.uniform(0.01, 0.03), 2)
        analysis = (
            "Low transaction volume with relatively high take rate. "
            "Reducing fees to incentivize consumer adoption and drive volume growth."
        )
    elif ctx["total_txns"] > 100 and current_rate < 0.32:
        new_rate = round(current_rate + random.uniform(0.01, 0.02), 2)
        analysis = (
            "Strong volume supports modest take rate increase. "
            "Platform value is proven — can capture more margin without hurting growth."
        )
    elif ctx["provider_count"] > 8 and current_rate > 0.30:
        new_rate = round(current_rate - random.uniform(0.005, 0.015), 2)
        analysis = (
            "Large provider network — reducing take rate to reward supply-side and "
            "maintain competitive provider payouts."
        )
    else:
        new_rate = current_rate
        analysis = (
            "Current take rate is balanced for marketplace maturity level. "
            "No adjustment needed — continuing to monitor."
        )

    thought_text = _simulate_reasoning(
        "take_rate_assessment",
        rate=f"{rate_pct:.1f}",
        txns=ctx["total_txns"],
        revenue=ctx["total_revenue"],
        platform_earnings=ctx["platform_earnings"],
        analysis=analysis,
    )

    rate_changed = abs(new_rate - current_rate) > 0.001

    thought = {
        "step": step,
        "thought": thought_text,
        "tool": "adjust_platform_take" if rate_changed else None,
        "tool_input": {"new_rate": new_rate} if rate_changed else {},
        "observation": "",
        "action_taken": "",
        "impact": "neutral",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if rate_changed:
        result = tool_adjust_platform_take(db, new_rate=new_rate)
        thought["observation"] = (
            f"Take rate {result['direction']}: {result['old_rate']}% → {result['new_rate']}%. "
            f"{result['reason']}"
        )
        thought["action_taken"] = (
            f"Platform take rate {result['direction']}: "
            f"{result['old_rate']}% → {result['new_rate']}%"
        )
        thought["impact"] = "positive" if result["direction"] == "decreased" else "neutral"

        _log_action(db, cycle, "take_rate_adjustment", thought["action_taken"],
                    json.dumps(result), thought["impact"])
    else:
        thought["observation"] = f"Take rate remains at {rate_pct:.1f}% — balanced for current conditions."
        thought["action_taken"] = f"Take rate unchanged at {rate_pct:.1f}%"

    thoughts.append(thought)

    # ── Step 4: Generate report (every 2nd cycle or if notable changes) ──

    should_report = (cycle % 2 == 0) or ctx["total_txns"] > 0
    if should_report:
        step += 1
        thought_text = _simulate_reasoning(
            "report_assessment",
            cycle=cycle,
            provider_count=ctx["provider_count"],
            consumer_count=ctx["consumer_count"],
            revenue=ctx["total_revenue"],
        )

        result = tool_generate_monthly_report(db)
        report = result["report"]

        suggestions_text = "; ".join(report["suggestions"][:3])

        thought = {
            "step": step,
            "thought": thought_text,
            "tool": "generate_monthly_report",
            "tool_input": {},
            "observation": (
                f"Report generated for {report['period']}: "
                f"{report['marketplace']['active_providers']} active providers, "
                f"{report['marketplace']['total_consumers']} consumers, "
                f"${report['financials']['total_revenue']:.2f} total revenue, "
                f"take rate {report['financials']['platform_take_rate']}. "
                f"Suggestions: {suggestions_text}"
            ),
            "action_taken": (
                f"Monthly report: ${report['financials']['total_revenue']:.2f} revenue, "
                f"{report['marketplace']['total_transactions']} queries, "
                f"{report['marketplace']['active_providers']} providers"
            ),
            "impact": "neutral",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        _log_action(db, cycle, "monthly_report", thought["action_taken"],
                    json.dumps(result), "neutral")
        thoughts.append(thought)

    db.commit()

    # Build summary
    actions_count = sum(1 for t in thoughts if t["tool"] is not None)
    completed_at = datetime.now(timezone.utc).isoformat()

    summary = (
        f"Cycle #{cycle} complete: {actions_count} actions taken across {len(thoughts)} reasoning steps. "
        f"Platform take rate: {get_platform_take_rate()*100:.1f}%."
    )

    return {
        "cycle_number": cycle,
        "thoughts": thoughts,
        "actions_taken": actions_count,
        "total_steps": len(thoughts),
        "platform_take_rate": round(get_platform_take_rate() * 100, 1),
        "summary": summary,
        "started_at": started_at,
        "completed_at": completed_at,
        # Legacy compat — flatten actions for old consumers
        "cycle_actions": [
            {
                "type": t.get("tool", "analysis") or "analysis",
                "description": t["action_taken"],
                "impact": t["impact"],
            }
            for t in thoughts
            if t["action_taken"]
        ],
        "action_count": actions_count,
    }


def _log_action(db: Session, cycle: int, action_type: str, description: str,
                details: str, impact: str):
    """Persist an autonomy action to the log table."""
    log = AutonomyLog(
        cycle_number=cycle,
        action_type=action_type,
        description=description,
        details=details,
        impact=impact,
    )
    db.add(log)
