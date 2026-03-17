"""Seed the database with initial demo data."""

import json
import secrets
from sqlalchemy.orm import Session
from app.models.schemas import Provider, Consumer, MCPTool
from app.mcp.mock_servers import MCP_TOOL_CATALOG


def seed_database(db: Session):
    """Seed with initial providers, consumers, and tools if empty."""
    if db.query(Provider).count() > 0:
        return

    # Seed providers
    providers_data = [
        ("BlueCross Regional Analytics", "BlueCross BlueShield", "https://bcbs-mcp.contextrx.io/v1/mcp"),
        ("National Health Data Cooperative", "NHDC", "https://nhdc-mcp.contextrx.io/v1/mcp"),
        ("MedInsight Analytics", "MedInsight Corp", "https://medinsight-mcp.contextrx.io/v1/mcp"),
    ]

    providers = []
    for name, org, endpoint in providers_data:
        p = Provider(
            name=f"{name} MCP Server",
            organization=org,
            mcp_endpoint=endpoint,
            api_key=f"crx_prov_{secrets.token_hex(16)}",
            status="active",
            data_domains=json.dumps(["claims", "pharmacy", "utilization"]),
            uptime_score=99.2,
            quality_score=96.5,
        )
        db.add(p)
        providers.append(p)

    db.flush()

    # Seed tools
    for i, tool_def in enumerate(MCP_TOOL_CATALOG):
        provider = providers[i % len(providers)]
        tool = MCPTool(
            provider_id=provider.id,
            name=tool_def["name"],
            description=tool_def["description"],
            input_schema=tool_def["input_schema"],
            price_per_call=tool_def["price_per_call"],
            category=tool_def["category"],
        )
        db.add(tool)

    # Seed consumers
    consumers_data = [
        ("HealthAI Platform", "HealthAI Inc.", "enterprise"),
        ("ClaimsBot Pro", "InsureTech Labs", "pay-as-you-go"),
        ("PopHealth Analytics", "PopHealth Co.", "pay-as-you-go"),
    ]

    for name, org, plan in consumers_data:
        c = Consumer(
            name=name,
            organization=org,
            api_key=f"crx_cons_{secrets.token_hex(16)}",
            plan=plan,
        )
        db.add(c)

    db.commit()
