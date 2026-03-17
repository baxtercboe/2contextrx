"""
Autonomy Agent — runs periodic cycles to:
1. Auto-onboard mock providers
2. Dynamically adjust reward bonuses
3. Suggest pricing changes
4. Generate summary reports

In production this would use LangChain + LLM. Here we simulate
intelligent decision-making with rule-based logic and randomization.
"""

import json
import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.schemas import Provider, Consumer, MCPTool, Transaction, AutonomyLog
from app.mcp.mock_servers import MCP_TOOL_CATALOG


_cycle_counter = 0

MOCK_ORGS = [
    ("Aetna Claims Analytics", "aetna-mcp.contextrx.io"),
    ("Cigna Population Health", "cigna-mcp.contextrx.io"),
    ("Humana Data Exchange", "humana-mcp.contextrx.io"),
    ("Kaiser Permanente Insights", "kaiser-mcp.contextrx.io"),
    ("UnitedHealth Data Cloud", "uhc-mcp.contextrx.io"),
    ("Anthem Regional Analytics", "anthem-mcp.contextrx.io"),
    ("Centene Community Data", "centene-mcp.contextrx.io"),
    ("Molina Healthcare Metrics", "molina-mcp.contextrx.io"),
]


def run_autonomy_cycle(db: Session) -> list[dict]:
    """Run one autonomy cycle. Returns list of actions taken."""
    global _cycle_counter
    _cycle_counter += 1
    cycle = _cycle_counter

    actions: list[dict] = []

    # Decision 1: Should we onboard a new provider?
    provider_count = db.query(Provider).count()
    if provider_count < len(MOCK_ORGS):
        action = _maybe_onboard_provider(db, cycle, provider_count)
        if action:
            actions.append(action)

    # Decision 2: Adjust pricing based on demand
    action = _maybe_adjust_pricing(db, cycle)
    if action:
        actions.append(action)

    # Decision 3: Adjust quality/uptime scores
    action = _update_provider_scores(db, cycle)
    if action:
        actions.append(action)

    # Decision 4: Generate status report
    action = _generate_report(db, cycle)
    if action:
        actions.append(action)

    db.commit()
    return actions


def _maybe_onboard_provider(db: Session, cycle: int, current_count: int) -> dict | None:
    if random.random() < 0.6:  # 60% chance each cycle
        org_name, endpoint = MOCK_ORGS[current_count % len(MOCK_ORGS)]
        import secrets
        api_key = f"crx_prov_{secrets.token_hex(16)}"

        provider = Provider(
            name=f"{org_name} MCP Server",
            organization=org_name,
            mcp_endpoint=f"https://{endpoint}/v1/mcp",
            api_key=api_key,
            status="active",
            data_domains=json.dumps(["claims", "pharmacy", "utilization"]),
            uptime_score=round(random.uniform(97.0, 99.9), 1),
            quality_score=round(random.uniform(90.0, 99.0), 1),
        )
        db.add(provider)
        db.flush()

        # Add tools for this provider
        tools_to_add = random.sample(MCP_TOOL_CATALOG, k=min(3, len(MCP_TOOL_CATALOG)))
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

        desc = f"Auto-onboarded provider '{org_name}' with {len(tools_to_add)} MCP tools. Endpoint: {endpoint}"
        log = AutonomyLog(
            cycle_number=cycle,
            action_type="provider_onboard",
            description=desc,
            details=json.dumps({"provider": org_name, "tools": len(tools_to_add), "endpoint": endpoint}),
            impact="positive",
        )
        db.add(log)
        return {"type": "provider_onboard", "description": desc, "impact": "positive"}

    return None


def _maybe_adjust_pricing(db: Session, cycle: int) -> dict | None:
    tools = db.query(MCPTool).all()
    if not tools:
        return None

    # Pick a random tool and adjust price based on demand
    tool = random.choice(tools)
    old_price = tool.price_per_call

    if tool.call_count > 100:
        # High demand — increase price slightly
        adjustment = round(random.uniform(0.001, 0.01), 3)
        tool.price_per_call = round(old_price + adjustment, 3)
        direction = "increased"
    elif tool.call_count < 10:
        # Low demand — decrease price slightly
        adjustment = round(random.uniform(0.001, 0.005), 3)
        tool.price_per_call = max(0.01, round(old_price - adjustment, 3))
        direction = "decreased"
    else:
        return None

    desc = f"Pricing {direction} for '{tool.name}': ${old_price:.3f} → ${tool.price_per_call:.3f} (demand-based)"
    log = AutonomyLog(
        cycle_number=cycle,
        action_type="pricing_adjustment",
        description=desc,
        details=json.dumps({"tool": tool.name, "old_price": old_price, "new_price": tool.price_per_call}),
        impact="neutral",
    )
    db.add(log)
    return {"type": "pricing_adjustment", "description": desc, "impact": "neutral"}


def _update_provider_scores(db: Session, cycle: int) -> dict | None:
    providers = db.query(Provider).filter(Provider.status == "active").all()
    if not providers:
        return None

    provider = random.choice(providers)
    old_uptime = provider.uptime_score
    old_quality = provider.quality_score

    # Simulate score drift
    provider.uptime_score = round(max(90.0, min(100.0, old_uptime + random.uniform(-0.5, 0.3))), 1)
    provider.quality_score = round(max(85.0, min(100.0, old_quality + random.uniform(-0.3, 0.5))), 1)

    desc = (
        f"Updated scores for '{provider.organization}': "
        f"uptime {old_uptime}→{provider.uptime_score}, "
        f"quality {old_quality}→{provider.quality_score}"
    )
    impact = "positive" if provider.uptime_score >= old_uptime else "neutral"
    log = AutonomyLog(
        cycle_number=cycle,
        action_type="score_update",
        description=desc,
        details=json.dumps({
            "provider": provider.organization,
            "uptime": {"old": old_uptime, "new": provider.uptime_score},
            "quality": {"old": old_quality, "new": provider.quality_score},
        }),
        impact=impact,
    )
    db.add(log)
    return {"type": "score_update", "description": desc, "impact": impact}


def _generate_report(db: Session, cycle: int) -> dict | None:
    if cycle % 3 != 0:  # Report every 3rd cycle
        return None

    total_providers = db.query(Provider).count()
    active_providers = db.query(Provider).filter(Provider.status == "active").count()
    total_consumers = db.query(Consumer).count()
    total_txns = db.query(Transaction).count()

    from sqlalchemy import func
    revenue_result = db.query(func.sum(Transaction.cost)).scalar() or 0.0

    report = {
        "cycle": cycle,
        "total_providers": total_providers,
        "active_providers": active_providers,
        "total_consumers": total_consumers,
        "total_transactions": total_txns,
        "total_revenue": round(float(revenue_result), 2),
        "platform_health": "nominal" if active_providers > 0 else "bootstrapping",
    }

    desc = (
        f"Cycle {cycle} report: {active_providers} active providers, "
        f"{total_consumers} consumers, ${report['total_revenue']:.2f} revenue, "
        f"{total_txns} total queries"
    )
    log = AutonomyLog(
        cycle_number=cycle,
        action_type="status_report",
        description=desc,
        details=json.dumps(report),
        impact="neutral",
    )
    db.add(log)
    return {"type": "status_report", "description": desc, "impact": "neutral"}
