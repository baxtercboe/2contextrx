"""Seed the database with rich demo data — 8 providers, 4 consumers, ~45 transactions."""

import json
import random
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.schemas import Provider, Consumer, MCPTool, Transaction


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
    {
        "name": "Aetna Claims Intelligence MCP Server",
        "organization": "Aetna Claims Analytics",
        "mcp_endpoint": "https://aetna-mcp.contextrx.io/v1/mcp",
        "data_domains": ["claims", "pharmacy", "utilization"],
        "uptime_score": 98.9,
        "quality_score": 96.1,
        "tools": [
            {
                "name": "get_pharmacy_cost_trends",
                "description": "Aggregated pharmacy cost trends by drug class and plan type. Tracks per-member-per-month costs over rolling 12 months.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "drug_class": {"type": "string", "enum": ["specialty", "generic", "brand", "biosimilar"]},
                        "plan_type": {"type": "string", "enum": ["commercial", "medicare", "medicaid"]},
                    },
                    "required": ["drug_class"],
                }),
                "price_per_call": 0.09,
                "category": "pharmacy",
            },
            {
                "name": "get_er_utilization_patterns",
                "description": "Emergency room utilization patterns by region and acuity level. Identifies avoidable ER visits at population level.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west"]},
                        "acuity": {"type": "string", "enum": ["emergent", "urgent", "semi_urgent", "non_urgent"]},
                    },
                    "required": ["region"],
                }),
                "price_per_call": 0.07,
                "category": "utilization_trends",
            },
        ],
    },
    {
        "name": "Cigna Population Health MCP Server",
        "organization": "Cigna Population Health",
        "mcp_endpoint": "https://cigna-mcp.contextrx.io/v1/mcp",
        "data_domains": ["population_health", "risk_stratification", "sdoh"],
        "uptime_score": 99.3,
        "quality_score": 97.5,
        "tools": [
            {
                "name": "get_sdoh_risk_indicators",
                "description": "Social determinants of health risk indicators by ZIP code cluster. Uses census + claims overlay — no individual data.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "zip_cluster": {"type": "string"},
                        "indicator": {"type": "string", "enum": ["food_insecurity", "transportation_barrier", "housing_instability", "health_literacy"]},
                    },
                    "required": ["indicator"],
                }),
                "price_per_call": 0.11,
                "category": "population_health",
            },
        ],
    },
    {
        "name": "Humana Data Exchange MCP Server",
        "organization": "Humana Data Exchange",
        "mcp_endpoint": "https://humana-mcp.contextrx.io/v1/mcp",
        "data_domains": ["medicare_advantage", "chronic_conditions", "quality"],
        "uptime_score": 99.6,
        "quality_score": 98.0,
        "tools": [
            {
                "name": "get_ma_star_ratings_trends",
                "description": "Medicare Advantage star ratings trends by plan and measure category. Aggregated across plan-level cohorts.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "measure_category": {"type": "string", "enum": ["outcomes", "patient_experience", "process", "access"]},
                        "year": {"type": "integer", "minimum": 2023, "maximum": 2025},
                    },
                    "required": ["measure_category"],
                }),
                "price_per_call": 0.13,
                "category": "quality_metrics",
            },
            {
                "name": "get_chronic_care_gaps",
                "description": "Identifies care gap rates for chronic conditions at population level. Helps target outreach programs.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "condition": {"type": "string", "enum": ["diabetes", "hypertension", "depression", "copd"]},
                        "gap_type": {"type": "string", "enum": ["screening", "medication_adherence", "follow_up", "preventive"]},
                    },
                    "required": ["condition"],
                }),
                "price_per_call": 0.10,
                "category": "chronic_conditions",
            },
        ],
    },
    {
        "name": "Kaiser Permanente Insights MCP Server",
        "organization": "Kaiser Permanente Insights",
        "mcp_endpoint": "https://kaiser-mcp.contextrx.io/v1/mcp",
        "data_domains": ["integrated_care", "outcomes", "cost_trends"],
        "uptime_score": 99.8,
        "quality_score": 98.4,
        "tools": [
            {
                "name": "get_integrated_care_outcomes",
                "description": "Aggregated outcomes for integrated care programs — readmission reduction, cost avoidance, patient satisfaction.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "program": {"type": "string", "enum": ["diabetes_mgmt", "heart_failure", "behavioral_integration", "post_discharge"]},
                        "metric": {"type": "string", "enum": ["readmission_rate", "cost_per_episode", "patient_satisfaction"]},
                    },
                    "required": ["program"],
                }),
                "price_per_call": 0.14,
                "category": "quality_metrics",
            },
        ],
    },
    {
        "name": "UnitedHealth Data Cloud MCP Server",
        "organization": "UnitedHealth Data Cloud",
        "mcp_endpoint": "https://uhc-mcp.contextrx.io/v1/mcp",
        "data_domains": ["claims", "network", "cost_analysis"],
        "uptime_score": 99.1,
        "quality_score": 95.8,
        "tools": [
            {
                "name": "get_network_adequacy_scores",
                "description": "Network adequacy metrics by specialty and geography. Measures access to care at population level.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "specialty": {"type": "string", "enum": ["primary_care", "cardiology", "oncology", "behavioral_health", "orthopedics"]},
                        "geography": {"type": "string", "enum": ["urban", "suburban", "rural"]},
                    },
                    "required": ["specialty"],
                }),
                "price_per_call": 0.08,
                "category": "network_analysis",
            },
            {
                "name": "get_claims_variance_analysis",
                "description": "Variance analysis comparing actual vs expected costs by service category. Identifies outlier patterns at facility level.",
                "input_schema": json.dumps({
                    "type": "object",
                    "properties": {
                        "service_category": {"type": "string", "enum": ["inpatient", "outpatient", "professional", "ancillary"]},
                        "comparison": {"type": "string", "enum": ["vs_benchmark", "vs_prior_year", "vs_peers"]},
                    },
                    "required": ["service_category"],
                }),
                "price_per_call": 0.11,
                "category": "cost_analysis",
            },
        ],
    },
]


SEED_CONSUMERS = [
    ("HealthAI Platform", "HealthAI Inc.", "enterprise"),
    ("ClaimsBot Pro", "InsureTech Labs", "pay-as-you-go"),
    ("PopHealth Analytics", "PopHealth Co.", "pay-as-you-go"),
    ("MediScope Intelligence", "MediScope AI", "enterprise"),
]


def seed_database(db: Session):
    """Seed with initial providers, consumers, tools, and transactions if empty."""
    if db.query(Provider).count() > 0:
        return

    provider_ids: list[int] = []
    all_tools: list[MCPTool] = []

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
        provider_ids.append(p.id)

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
            db.flush()
            all_tools.append(tool)

    consumer_ids: list[int] = []
    for name, org, plan in SEED_CONSUMERS:
        c = Consumer(
            name=name,
            organization=org,
            api_key=f"crx_cons_{secrets.token_hex(16)}",
            plan=plan,
        )
        db.add(c)
        db.flush()
        consumer_ids.append(c.id)

    # ── Seed ~45 transactions with varied cost/reward breakdowns ──────────
    base_time = datetime.now(timezone.utc) - timedelta(days=7)
    random.seed(42)

    for i in range(45):
        tool = random.choice(all_tools)
        consumer_id = random.choice(consumer_ids)
        provider = db.query(Provider).filter(Provider.id == tool.provider_id).first()
        if not provider:
            continue

        base_cost = tool.price_per_call
        n_params = random.randint(1, 4)
        complexity_multiplier = round(1.0 + (n_params - 1) * 0.3 + random.uniform(-0.1, 0.1), 2)
        complexity_multiplier = max(1.0, min(2.5, complexity_multiplier))

        consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()
        qc = consumer.query_count if consumer else 0
        if qc >= 50:
            volume_multiplier = 0.88
        elif qc >= 20:
            volume_multiplier = 0.92
        elif qc >= 10:
            volume_multiplier = 0.95
        else:
            volume_multiplier = 1.0

        cost = round(base_cost * complexity_multiplier * volume_multiplier, 4)
        provider_base_payout = round(cost * 0.70, 4)

        uptime_bonus = round(cost * 0.03, 4) if provider.uptime_score >= 99.5 else 0.0
        quality_bonus = round(cost * 0.02, 4) if provider.quality_score >= 95.0 else 0.0

        provider_payout = round(provider_base_payout + uptime_bonus + quality_bonus, 4)
        platform_fee = round(cost - provider_payout, 4)
        latency_ms = round(random.uniform(40, 200), 1)

        txn = Transaction(
            provider_id=tool.provider_id,
            consumer_id=consumer_id,
            tool_name=tool.name,
            session_id=f"seed_sess_{secrets.token_hex(6)}",
            base_cost=base_cost,
            complexity_multiplier=complexity_multiplier,
            volume_multiplier=volume_multiplier,
            cost=cost,
            provider_base_payout=provider_base_payout,
            uptime_bonus=uptime_bonus,
            quality_bonus=quality_bonus,
            provider_payout=provider_payout,
            platform_fee=platform_fee,
            latency_ms=latency_ms,
            status="completed",
            routed_to_endpoint=provider.mcp_endpoint,
            created_at=base_time + timedelta(hours=i * 3, minutes=random.randint(0, 59)),
        )
        db.add(txn)

        tool.call_count += 1

        if consumer:
            consumer.total_spent = round((consumer.total_spent or 0) + cost, 4)
            consumer.query_count = (consumer.query_count or 0) + 1

        provider.total_earnings = round((provider.total_earnings or 0) + provider_payout, 4)

    db.commit()
