"""Seed the database with initial demo data."""

import json
import secrets
from sqlalchemy.orm import Session
from app.models.schemas import Provider, Consumer, MCPTool


# Full tool catalog — matches both the generic tools and the dedicated provider servers
SEED_PROVIDERS = [
    {
        "name": "BlueCross Regional Analytics MCP Server",
        "organization": "BlueCross BlueShield",
        "mcp_endpoint": "https://bcbs-mcp.contextrx.io/v1/mcp",
        "data_domains": ["claims", "chronic_conditions", "cost_trends"],
        "uptime_score": 99.7,
        "quality_score": 97.2,
        "tools": [
            {
                "name": "query_aggregate_claims",
                "description": "Query aggregated claims data by diagnosis code group, region, and date range. Returns population-level statistics — never individual records.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "diagnosis": {"type": "string", "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd", "asthma", "depression"]},
                        "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west", "southwest"]},
                        "date_range": {"type": "string", "enum": ["last_30d", "last_90d", "last_6m", "last_12m", "ytd"]},
                    },
                    "required": ["diagnosis"],
                }),
                "price_per_call": 0.08,
                "category": "claims_aggregation",
            },
            {
                "name": "get_cost_trends",
                "description": "Returns cost trend analysis for specified medical procedures over time. All data aggregated at facility level minimum.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "procedure": {"type": "string", "enum": ["knee_replacement", "hip_replacement", "cardiac_catheterization", "colonoscopy", "mri_brain", "ct_abdomen", "dialysis"]},
                        "time_window": {"type": "string", "enum": ["quarterly", "monthly", "annual"]},
                        "plan_type": {"type": "string", "enum": ["commercial", "medicare", "medicaid", "all"]},
                    },
                    "required": ["procedure"],
                }),
                "price_per_call": 0.10,
                "category": "cost_analysis",
            },
            {
                "name": "get_diabetes_claims_trends",
                "description": "Returns aggregated diabetes-related claims trends by region and time period. Data is pre-aggregated across minimum 50-patient cohorts.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west", "southwest"]},
                        "time_period": {"type": "string", "enum": ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"]},
                        "metric": {"type": "string", "enum": ["cost_per_member", "utilization_rate", "readmission_rate"]},
                    },
                    "required": ["region", "time_period"],
                }),
                "price_per_call": 0.08,
                "category": "chronic_conditions",
            },
        ],
    },
    {
        "name": "National Health Data Cooperative MCP Server",
        "organization": "NHDC",
        "mcp_endpoint": "https://nhdc-mcp.contextrx.io/v1/mcp",
        "data_domains": ["cost_analysis", "population_health", "risk_stratification"],
        "uptime_score": 99.4,
        "quality_score": 96.8,
        "tools": [
            {
                "name": "get_cohort_cost_analysis",
                "description": "Deep-dive cost analysis for patient cohorts by diagnosis, age, and plan type. Includes national benchmarks and percentile rankings.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "diagnosis_group": {"type": "string", "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd"]},
                        "age_bracket": {"type": "string", "enum": ["18-34", "35-49", "50-64", "65+"]},
                        "plan_type": {"type": "string", "enum": ["commercial", "medicare", "medicaid"]},
                    },
                    "required": ["diagnosis_group"],
                }),
                "price_per_call": 0.12,
                "category": "cost_analysis",
            },
            {
                "name": "get_population_risk_stratification",
                "description": "Population-level risk tier distribution and cost allocation by risk category. Uses validated risk scoring on de-identified data.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "population_segment": {"type": "string", "enum": ["all_members", "chronic_only", "high_utilizers", "new_enrollees"]},
                        "region": {"type": "string", "enum": ["national", "northeast", "southeast", "midwest", "west"]},
                    },
                    "required": ["population_segment"],
                }),
                "price_per_call": 0.15,
                "category": "population_health",
            },
            {
                "name": "get_drug_utilization_stats",
                "description": "Aggregated prescription drug utilization statistics by therapeutic class and region. No patient-level data exposed.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "therapeutic_class": {"type": "string", "enum": ["antidiabetics", "antihypertensives", "statins", "biologics", "oncology"]},
                        "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west", "southwest"]},
                        "quarter": {"type": "string"},
                    },
                    "required": ["therapeutic_class"],
                }),
                "price_per_call": 0.10,
                "category": "pharmacy",
            },
        ],
    },
    {
        "name": "MedInsight Analytics MCP Server",
        "organization": "MedInsight Corp",
        "mcp_endpoint": "https://medinsight-mcp.contextrx.io/v1/mcp",
        "data_domains": ["utilization_trends", "service_lines", "telehealth"],
        "uptime_score": 99.9,
        "quality_score": 95.5,
        "tools": [
            {
                "name": "get_regional_trend_query",
                "description": "Healthcare utilization trends by state and service type. Tracks monthly volumes, costs, and trend direction.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "state": {"type": "string"},
                        "service_type": {"type": "string", "enum": ["inpatient", "outpatient", "emergency", "pharmacy", "telehealth"]},
                        "year": {"type": "integer", "minimum": 2023, "maximum": 2025},
                    },
                    "required": ["state", "service_type"],
                }),
                "price_per_call": 0.06,
                "category": "utilization_trends",
            },
            {
                "name": "get_service_line_benchmarks",
                "description": "Benchmark comparison across service lines — length of stay, cost per case, readmission rates by facility tier.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "service_line": {"type": "string", "enum": ["cardiology", "orthopedics", "oncology", "maternity", "behavioral_health"]},
                        "facility_tier": {"type": "string", "enum": ["academic_center", "community", "rural_access", "all"]},
                    },
                    "required": ["service_line"],
                }),
                "price_per_call": 0.09,
                "category": "quality_metrics",
            },
            {
                "name": "get_readmission_risk_scores",
                "description": "Population-level readmission risk scores by condition and facility type. Scores are aggregate averages, not individual predictions.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "condition": {"type": "string", "enum": ["ami", "pneumonia", "chf", "hip_replacement", "copd"]},
                        "facility_type": {"type": "string", "enum": ["academic_medical_center", "community_hospital", "critical_access"]},
                        "region": {"type": "string"},
                    },
                    "required": ["condition"],
                }),
                "price_per_call": 0.15,
                "category": "quality_metrics",
            },
            {
                "name": "get_telehealth_adoption_metrics",
                "description": "Telehealth adoption and utilization metrics across specialties and demographics. Aggregated at county level minimum.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "specialty": {"type": "string", "enum": ["primary_care", "behavioral_health", "dermatology", "cardiology", "endocrinology"]},
                        "time_period": {"type": "string"},
                        "demographic": {"type": "string", "enum": ["all", "rural", "urban", "suburban"]},
                    },
                    "required": ["specialty"],
                }),
                "price_per_call": 0.07,
                "category": "digital_health",
            },
        ],
    },
]


SEED_CONSUMERS = [
    ("HealthAI Platform", "HealthAI Inc.", "enterprise"),
    ("ClaimsBot Pro", "InsureTech Labs", "pay-as-you-go"),
    ("PopHealth Analytics", "PopHealth Co.", "pay-as-you-go"),
]


def seed_database(db: Session):
    """Seed with initial providers, consumers, and tools if empty."""
    if db.query(Provider).count() > 0:
        return

    for prov_data in SEED_PROVIDERS:
        p = Provider(
            name=prov_data["name"],
            organization=prov_data["organization"],
            mcp_endpoint=prov_data["mcp_endpoint"],
            api_key=f"crx_prov_{secrets.token_hex(16)}",
            status="active",
            data_domains=json.dumps(prov_data["data_domains"]),
            uptime_score=prov_data["uptime_score"],
            quality_score=prov_data["quality_score"],
        )
        db.add(p)
        db.flush()

        for tool_def in prov_data["tools"]:
            tool = MCPTool(
                provider_id=p.id,
                name=tool_def["name"],
                description=tool_def["description"],
                input_schema=tool_def["input_schema"],
                price_per_call=tool_def["price_per_call"],
                category=tool_def["category"],
            )
            db.add(tool)

    for name, org, plan in SEED_CONSUMERS:
        c = Consumer(
            name=name,
            organization=org,
            api_key=f"crx_cons_{secrets.token_hex(16)}",
            plan=plan,
        )
        db.add(c)

    db.commit()
