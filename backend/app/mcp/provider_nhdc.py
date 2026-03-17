"""
Dedicated Mock MCP Provider Server: National Health Data Cooperative (NHDC)
Specializes in: cohort cost analysis, population health benchmarks, SDoH overlay data.
"""

import random
import time
from fastapi import APIRouter

router = APIRouter(prefix="/api/mock-providers/nhdc", tags=["mock-provider-nhdc"])

PROVIDER_ID = "nhdc_cooperative"
PROVIDER_META = {
    "name": "National Health Data Cooperative MCP Server",
    "version": "3.0.1",
    "protocol": "mcp/1.0",
    "privacy_level": "aggregated_only",
    "min_cohort_size": 100,
    "data_freshness": "daily",
    "endpoint_slug": "nhdc",
}


@router.get("/health")
def health():
    return {"status": "healthy", "provider": PROVIDER_ID, "uptime_pct": 99.4}


@router.get("/capabilities")
def capabilities():
    return {
        "provider": PROVIDER_META,
        "tools": [
            {
                "name": "get_cohort_cost_analysis",
                "description": "Deep-dive cost analysis for patient cohorts by diagnosis, age, and plan type. "
                               "Includes national benchmarks and percentile rankings.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "diagnosis_group": {
                            "type": "string",
                            "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd"],
                        },
                        "age_bracket": {
                            "type": "string",
                            "enum": ["18-34", "35-49", "50-64", "65+"],
                        },
                        "plan_type": {
                            "type": "string",
                            "enum": ["commercial", "medicare", "medicaid"],
                        },
                    },
                    "required": ["diagnosis_group"],
                },
            },
            {
                "name": "get_population_risk_stratification",
                "description": "Population-level risk tier distribution and cost allocation by risk category. "
                               "Uses validated risk scoring methodology on de-identified data.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "population_segment": {
                            "type": "string",
                            "enum": ["all_members", "chronic_only", "high_utilizers", "new_enrollees"],
                        },
                        "region": {
                            "type": "string",
                            "enum": ["national", "northeast", "southeast", "midwest", "west"],
                        },
                    },
                    "required": ["population_segment"],
                },
            },
        ],
    }


@router.post("/invoke")
def invoke_tool(request: dict):
    tool_name = request.get("tool_name", "")
    params = request.get("parameters", {})

    start = time.time()

    if tool_name == "get_cohort_cost_analysis":
        result = _handle_cohort_cost(params)
    elif tool_name == "get_population_risk_stratification":
        result = _handle_risk_stratification(params)
    else:
        return {"error": f"Unknown tool: {tool_name}", "provider": PROVIDER_ID}

    processing_ms = round((time.time() - start) * 1000, 1)

    return {
        "provider": PROVIDER_ID,
        "tool": tool_name,
        "processing_ms": processing_ms,
        "result": result,
        "privacy_attestation": {
            "phi_accessed": False,
            "min_cohort_size": 100,
            "aggregation_level": "population",
            "data_source": "pre-computed aggregates",
        },
    }


def _handle_cohort_cost(params: dict) -> dict:
    dx = params.get("diagnosis_group", "diabetes_t2")
    age = params.get("age_bracket", "50-64")
    plan = params.get("plan_type", "commercial")

    cohort_size = random.randint(3000, 45000)
    total_cost = random.uniform(12000, 55000)

    return {
        "diagnosis_group": dx,
        "age_bracket": age,
        "plan_type": plan,
        "cohort_size": cohort_size,
        "cost_breakdown": {
            "total_annual_per_member": round(total_cost, 2),
            "inpatient": round(total_cost * random.uniform(0.20, 0.45), 2),
            "outpatient": round(total_cost * random.uniform(0.12, 0.28), 2),
            "pharmacy": round(total_cost * random.uniform(0.18, 0.38), 2),
            "emergency": round(total_cost * random.uniform(0.03, 0.10), 2),
            "professional_services": round(total_cost * random.uniform(0.05, 0.15), 2),
            "lab_diagnostics": round(total_cost * random.uniform(0.02, 0.08), 2),
        },
        "benchmarks": {
            "national_avg": round(random.uniform(15000, 40000), 2),
            "peer_group_avg": round(random.uniform(13000, 38000), 2),
            "percentile_rank": random.randint(15, 95),
            "vs_benchmark_pct": round(random.uniform(-20, 30), 1),
        },
        "utilization_metrics": {
            "admits_per_1000": round(random.uniform(50, 250), 1),
            "er_visits_per_1000": round(random.uniform(100, 500), 1),
            "specialist_referrals_per_1000": round(random.uniform(200, 800), 1),
            "scripts_per_member": round(random.uniform(4, 18), 1),
        },
        "privacy_notice": f"k-anonymized cohort of {cohort_size:,}. No individual-level data returned.",
    }


def _handle_risk_stratification(params: dict) -> dict:
    segment = params.get("population_segment", "all_members")
    region = params.get("region", "national")

    total_pop = random.randint(100000, 2000000)

    tiers = []
    cost_pcts = [
        ("Very High (top 1%)", 0.01, (80000, 250000)),
        ("High (top 5%)", 0.04, (25000, 80000)),
        ("Moderate (top 20%)", 0.15, (8000, 25000)),
        ("Low-Moderate", 0.30, (2000, 8000)),
        ("Low Risk", 0.50, (500, 2000)),
    ]

    for tier_name, pct, (cost_lo, cost_hi) in cost_pcts:
        tier_size = int(total_pop * pct)
        avg_cost = random.uniform(cost_lo, cost_hi)
        tiers.append({
            "tier": tier_name,
            "population_pct": round(pct * 100, 1),
            "member_count": tier_size,
            "avg_annual_cost": round(avg_cost, 2),
            "total_tier_cost": round(avg_cost * tier_size, 2),
            "cost_share_of_total_pct": round(avg_cost * tier_size / (total_pop * 8000) * 100, 1),
        })

    return {
        "segment": segment,
        "region": region,
        "total_population": total_pop,
        "risk_tiers": tiers,
        "summary": {
            "top_5pct_cost_share": round(sum(t["cost_share_of_total_pct"] for t in tiers[:2]), 1),
            "avg_population_cost": round(random.uniform(5000, 12000), 2),
            "risk_score_methodology": "CMS-HCC v28 (adapted for aggregate)",
        },
        "privacy_notice": f"Aggregated across {total_pop:,} members. Individual risk scores never exposed.",
    }
