"""
Mock MCP (Model Context Protocol) servers that simulate healthcare data providers.
These return pre-aggregated, privacy-preserved data — never raw PHI.
"""

import json
import random
from datetime import datetime, timedelta


MCP_TOOL_CATALOG: list[dict] = [
    {
        "name": "get_diabetes_claims_trends",
        "description": "Returns aggregated diabetes-related claims trends by region and time period. Data is pre-aggregated across minimum 50-patient cohorts.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west", "southwest"]},
                "time_period": {"type": "string", "enum": ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"]},
                "metric": {"type": "string", "enum": ["cost_per_member", "utilization_rate", "readmission_rate"]}
            },
            "required": ["region", "time_period"]
        }),
        "price_per_call": 0.08,
        "category": "chronic_conditions",
        "provider_name": "BlueCross Regional Analytics"
    },
    {
        "name": "get_cohort_cost_analysis",
        "description": "Provides cost analysis for specified patient cohorts based on diagnosis groups. All data k-anonymized (k>=50).",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "diagnosis_group": {"type": "string", "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd"]},
                "age_bracket": {"type": "string", "enum": ["18-34", "35-49", "50-64", "65+"]},
                "plan_type": {"type": "string", "enum": ["commercial", "medicare", "medicaid"]}
            },
            "required": ["diagnosis_group"]
        }),
        "price_per_call": 0.12,
        "category": "cost_analysis",
        "provider_name": "National Health Data Cooperative"
    },
    {
        "name": "get_regional_trend_query",
        "description": "Returns healthcare utilization trends by geographic region with demographic breakdowns. Minimum cohort size enforced.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "state": {"type": "string"},
                "service_type": {"type": "string", "enum": ["inpatient", "outpatient", "emergency", "pharmacy", "telehealth"]},
                "year": {"type": "integer", "minimum": 2023, "maximum": 2025}
            },
            "required": ["state", "service_type"]
        }),
        "price_per_call": 0.06,
        "category": "utilization_trends",
        "provider_name": "MedInsight Analytics"
    },
    {
        "name": "get_drug_utilization_stats",
        "description": "Aggregated prescription drug utilization statistics by therapeutic class and region. No patient-level data exposed.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "therapeutic_class": {"type": "string", "enum": ["antidiabetics", "antihypertensives", "statins", "biologics", "oncology"]},
                "region": {"type": "string", "enum": ["northeast", "southeast", "midwest", "west", "southwest"]},
                "quarter": {"type": "string"}
            },
            "required": ["therapeutic_class"]
        }),
        "price_per_call": 0.10,
        "category": "pharmacy",
        "provider_name": "PharmaClaims Network"
    },
    {
        "name": "get_readmission_risk_scores",
        "description": "Population-level readmission risk scores by condition and facility type. Scores are aggregate averages, not individual predictions.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "condition": {"type": "string", "enum": ["ami", "pneumonia", "chf", "hip_replacement", "copd"]},
                "facility_type": {"type": "string", "enum": ["academic_medical_center", "community_hospital", "critical_access"]},
                "region": {"type": "string"}
            },
            "required": ["condition"]
        }),
        "price_per_call": 0.15,
        "category": "quality_metrics",
        "provider_name": "QualityFirst Health Systems"
    },
    {
        "name": "get_telehealth_adoption_metrics",
        "description": "Telehealth adoption and utilization metrics across specialties and demographics. Aggregated at county level minimum.",
        "input_schema": json.dumps({
            "type": "object",
            "properties": {
                "specialty": {"type": "string", "enum": ["primary_care", "behavioral_health", "dermatology", "cardiology", "endocrinology"]},
                "time_period": {"type": "string"},
                "demographic": {"type": "string", "enum": ["all", "rural", "urban", "suburban"]}
            },
            "required": ["specialty"]
        }),
        "price_per_call": 0.07,
        "category": "digital_health",
        "provider_name": "TeleHealth Insights Co."
    },
]


def execute_mock_mcp_tool(tool_name: str, parameters: dict) -> dict:
    """Execute a mock MCP tool call and return synthetic aggregated data."""

    handlers = {
        "get_diabetes_claims_trends": _handle_diabetes_trends,
        "get_cohort_cost_analysis": _handle_cohort_cost,
        "get_regional_trend_query": _handle_regional_trend,
        "get_drug_utilization_stats": _handle_drug_utilization,
        "get_readmission_risk_scores": _handle_readmission_risk,
        "get_telehealth_adoption_metrics": _handle_telehealth,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}
    return handler(parameters)


def _handle_diabetes_trends(params: dict) -> dict:
    region = params.get("region", "northeast")
    period = params.get("time_period", "Q4-2025")
    metric = params.get("metric", "cost_per_member")

    base_cost = random.uniform(1200, 2800)
    return {
        "query": "diabetes_claims_trends",
        "region": region,
        "time_period": period,
        "cohort_size": random.randint(5000, 50000),
        "metrics": {
            "cost_per_member_per_month": round(base_cost / 12, 2),
            "annual_cost_per_member": round(base_cost, 2),
            "utilization_rate_per_1000": round(random.uniform(180, 340), 1),
            "readmission_rate_30day": round(random.uniform(8.5, 18.2), 1),
            "avg_a1c_category": random.choice(["controlled (<7%)", "moderate (7-9%)", "uncontrolled (>9%)"]),
        },
        "trend_direction": random.choice(["increasing", "stable", "decreasing"]),
        "yoy_change_percent": round(random.uniform(-5.2, 12.8), 1),
        "privacy_notice": "Data aggregated across minimum 50-patient cohorts. No individual PHI accessible.",
    }


def _handle_cohort_cost(params: dict) -> dict:
    dx = params.get("diagnosis_group", "diabetes_t2")
    age = params.get("age_bracket", "50-64")
    plan = params.get("plan_type", "commercial")

    return {
        "query": "cohort_cost_analysis",
        "diagnosis_group": dx,
        "age_bracket": age,
        "plan_type": plan,
        "cohort_size": random.randint(2000, 30000),
        "cost_breakdown": {
            "total_annual_cost": round(random.uniform(8000, 45000), 2),
            "inpatient": round(random.uniform(2000, 15000), 2),
            "outpatient": round(random.uniform(1500, 8000), 2),
            "pharmacy": round(random.uniform(3000, 18000), 2),
            "emergency": round(random.uniform(500, 4000), 2),
            "other": round(random.uniform(200, 2000), 2),
        },
        "benchmarks": {
            "national_average": round(random.uniform(10000, 35000), 2),
            "percentile_rank": random.randint(20, 95),
        },
        "privacy_notice": "K-anonymized with k>=50. No individual records returned.",
    }


def _handle_regional_trend(params: dict) -> dict:
    state = params.get("state", "CA")
    service = params.get("service_type", "outpatient")
    year = params.get("year", 2025)

    months = []
    for m in range(1, 13):
        months.append({
            "month": f"{year}-{m:02d}",
            "utilization_per_1000": round(random.uniform(50, 400), 1),
            "avg_cost": round(random.uniform(200, 3500), 2),
        })

    return {
        "query": "regional_trend",
        "state": state,
        "service_type": service,
        "year": year,
        "monthly_data": months,
        "summary": {
            "total_utilization": sum(m["utilization_per_1000"] for m in months),
            "avg_monthly_cost": round(sum(m["avg_cost"] for m in months) / 12, 2),
            "trend": random.choice(["increasing", "stable", "decreasing"]),
        },
        "privacy_notice": "County-level minimum aggregation enforced.",
    }


def _handle_drug_utilization(params: dict) -> dict:
    drug_class = params.get("therapeutic_class", "antidiabetics")
    region = params.get("region", "northeast")

    return {
        "query": "drug_utilization",
        "therapeutic_class": drug_class,
        "region": region,
        "top_molecules": [
            {"name": "Metformin", "market_share_pct": round(random.uniform(25, 45), 1), "avg_30day_cost": round(random.uniform(4, 15), 2)},
            {"name": "Semaglutide", "market_share_pct": round(random.uniform(10, 25), 1), "avg_30day_cost": round(random.uniform(800, 1200), 2)},
            {"name": "Empagliflozin", "market_share_pct": round(random.uniform(8, 18), 1), "avg_30day_cost": round(random.uniform(400, 600), 2)},
        ],
        "total_scripts_per_1000": round(random.uniform(80, 250), 1),
        "generic_utilization_pct": round(random.uniform(55, 85), 1),
        "specialty_drug_pct": round(random.uniform(5, 25), 1),
        "privacy_notice": "Aggregated across all participating plans. No prescriber or patient data included.",
    }


def _handle_readmission_risk(params: dict) -> dict:
    condition = params.get("condition", "chf")
    facility = params.get("facility_type", "community_hospital")

    return {
        "query": "readmission_risk",
        "condition": condition,
        "facility_type": facility,
        "population_risk_score": round(random.uniform(0.08, 0.25), 3),
        "national_benchmark": round(random.uniform(0.10, 0.20), 3),
        "risk_factors": [
            {"factor": "Comorbidity burden", "contribution_pct": round(random.uniform(20, 40), 1)},
            {"factor": "Length of stay", "contribution_pct": round(random.uniform(10, 25), 1)},
            {"factor": "Social determinants", "contribution_pct": round(random.uniform(8, 20), 1)},
            {"factor": "Medication adherence", "contribution_pct": round(random.uniform(10, 30), 1)},
        ],
        "sample_size": random.randint(1000, 15000),
        "privacy_notice": "Population-level scores only. No individual risk predictions.",
    }


def _handle_telehealth(params: dict) -> dict:
    specialty = params.get("specialty", "primary_care")
    demo = params.get("demographic", "all")

    return {
        "query": "telehealth_adoption",
        "specialty": specialty,
        "demographic": demo,
        "adoption_rate_pct": round(random.uniform(15, 65), 1),
        "visit_volume_trend": [
            {"quarter": "Q1-2025", "visits_per_1000": round(random.uniform(20, 120), 1)},
            {"quarter": "Q2-2025", "visits_per_1000": round(random.uniform(25, 130), 1)},
            {"quarter": "Q3-2025", "visits_per_1000": round(random.uniform(22, 125), 1)},
            {"quarter": "Q4-2025", "visits_per_1000": round(random.uniform(28, 140), 1)},
        ],
        "patient_satisfaction": round(random.uniform(3.5, 4.8), 1),
        "avg_wait_time_minutes": round(random.uniform(2, 15), 1),
        "no_show_rate_pct": round(random.uniform(3, 12), 1),
        "privacy_notice": "County-level aggregation minimum. No individual visit records.",
    }
