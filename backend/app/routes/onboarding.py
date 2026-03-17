"""
One-click onboarding endpoints for quick provider/consumer registration.
Auto-generates mock MCP endpoints, API keys, and seed tools.
"""

import json
import secrets
import random
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import Provider, Consumer, MCPTool
from app.models.pydantic_models import ProviderResponse, ConsumerResponse

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Template tools for auto-provisioned providers
TEMPLATE_TOOLS = [
    {
        "name": "query_aggregate_claims",
        "description": "Query aggregated claims data by diagnosis code group, region, and date range. Returns population-level statistics only.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "diagnosis": {"type": "string", "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd"]},
                "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west"]},
                "date_range": {"type": "string", "enum": ["last_30d", "last_90d", "last_12m"]},
            },
            "required": ["diagnosis"],
        }),
        "price_per_call": 0.08,
        "category": "claims_aggregation",
    },
    {
        "name": "get_cost_trends",
        "description": "Cost trend analysis for medical procedures over time. Data aggregated at facility level minimum.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "procedure": {"type": "string", "enum": ["knee_replacement", "cardiac_catheterization", "colonoscopy", "dialysis"]},
                "time_window": {"type": "string", "enum": ["quarterly", "monthly", "annual"]},
            },
            "required": ["procedure"],
        }),
        "price_per_call": 0.10,
        "category": "cost_analysis",
    },
    {
        "name": "get_readmission_risk_scores",
        "description": "Population-level readmission risk scores by condition. Aggregate averages only.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "condition": {"type": "string", "enum": ["ami", "pneumonia", "chf", "copd"]},
                "facility_type": {"type": "string", "enum": ["academic_medical_center", "community_hospital"]},
            },
            "required": ["condition"],
        }),
        "price_per_call": 0.15,
        "category": "quality_metrics",
    },
]


@router.post("/quick-provider", response_model=ProviderResponse)
def quick_register_provider(db: Session = Depends(get_db)):
    """One-click provider registration with auto-generated mock data."""
    # Generate unique org name
    adjectives = ["Regional", "National", "Advanced", "Unified", "Premier", "Pacific", "Atlantic", "Central"]
    nouns = ["Health Analytics", "Claims Network", "Data Cooperative", "MedTech Solutions", "Population Health"]
    org_name = f"{random.choice(adjectives)} {random.choice(nouns)}"

    slug = org_name.lower().replace(" ", "-")
    api_key = f"crx_prov_{secrets.token_hex(16)}"

    provider = Provider(
        name=f"{org_name} MCP Server",
        organization=org_name,
        mcp_endpoint=f"https://{slug}-mcp.contextrx.io/v1/mcp",
        api_key=api_key,
        status="active",
        data_domains=json.dumps(["claims", "cost_analysis", "quality_metrics"]),
        uptime_score=round(random.uniform(97.5, 99.9), 1),
        quality_score=round(random.uniform(92.0, 99.0), 1),
    )
    db.add(provider)
    db.flush()

    # Auto-provision 2-3 tools
    tool_count = random.randint(2, 3)
    for template in random.sample(TEMPLATE_TOOLS, k=tool_count):
        # Slightly vary pricing
        price = round(template["price_per_call"] * random.uniform(0.8, 1.3), 2)
        tool = MCPTool(
            provider_id=provider.id,
            name=template["name"],
            description=template["description"],
            input_schema=template["input_schema"],
            price_per_call=price,
            category=template["category"],
        )
        db.add(tool)

    db.commit()
    db.refresh(provider)
    return provider


@router.post("/quick-consumer", response_model=ConsumerResponse)
def quick_register_consumer(db: Session = Depends(get_db)):
    """One-click consumer registration with auto-generated API key."""
    adjectives = ["Smart", "Rapid", "Deep", "Precision", "Cloud", "Insight", "Next"]
    nouns = ["AI Platform", "Health Bot", "Analytics Engine", "Claims Processor", "Care Advisor"]
    app_name = f"{random.choice(adjectives)} {random.choice(nouns)}"

    orgs = ["HealthTech Inc.", "MedAI Labs", "CarePoint Solutions", "DataRx Corp", "VitalSense AI"]

    consumer = Consumer(
        name=app_name,
        organization=random.choice(orgs),
        api_key=f"crx_cons_{secrets.token_hex(16)}",
        plan="pay-as-you-go",
    )
    db.add(consumer)
    db.commit()
    db.refresh(consumer)
    return consumer
