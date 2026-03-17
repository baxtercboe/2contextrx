"""
Dedicated Mock MCP Provider Server: BlueCross Regional Analytics
Specializes in: claims aggregation, chronic condition trends, regional cost data.
Simulates a real MCP server running inside a payer's environment.
"""

import random
import time
from fastapi import APIRouter

router = APIRouter(prefix="/api/mock-providers/bluecross", tags=["mock-provider-bluecross"])

PROVIDER_ID = "bluecross_regional"
PROVIDER_META = {
    "name": "BlueCross Regional Analytics MCP Server",
    "version": "2.1.0",
    "protocol": "mcp/1.0",
    "privacy_level": "aggregated_only",
    "min_cohort_size": 50,
    "data_freshness": "weekly",
    "endpoint_slug": "bluecross",
}


@router.get("/health")
def health():
    return {"status": "healthy", "provider": PROVIDER_ID, "uptime_pct": 99.7}


@router.get("/capabilities")
def capabilities():
    return {
        "provider": PROVIDER_META,
        "tools": [
            {
                "name": "query_aggregate_claims",
                "description": "Query aggregated claims data by diagnosis code group, region, and date range. "
                               "Returns population-level statistics — never individual records.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "diagnosis": {
                            "type": "string",
                            "enum": ["diabetes_t2", "hypertension", "copd", "chf", "ckd", "asthma", "depression"],
                            "description": "ICD-10 diagnosis group",
                        },
                        "region": {
                            "type": "string",
                            "enum": ["northeast", "southeast", "midwest", "west", "southwest"],
                        },
                        "date_range": {
                            "type": "string",
                            "enum": ["last_30d", "last_90d", "last_6m", "last_12m", "ytd"],
                        },
                    },
                    "required": ["diagnosis"],
                },
            },
            {
                "name": "get_cost_trends",
                "description": "Returns cost trend analysis for specified medical procedures over time. "
                               "All data aggregated at facility level minimum.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "procedure": {
                            "type": "string",
                            "enum": [
                                "knee_replacement", "hip_replacement", "cardiac_catheterization",
                                "colonoscopy", "mri_brain", "ct_abdomen", "dialysis",
                            ],
                        },
                        "time_window": {
                            "type": "string",
                            "enum": ["quarterly", "monthly", "annual"],
                        },
                        "plan_type": {
                            "type": "string",
                            "enum": ["commercial", "medicare", "medicaid", "all"],
                        },
                    },
                    "required": ["procedure"],
                },
            },
        ],
    }


@router.post("/invoke")
def invoke_tool(request: dict):
    """MCP tool invocation endpoint — this is what the central proxy calls."""
    tool_name = request.get("tool_name", "")
    params = request.get("parameters", {})

    start = time.time()

    if tool_name == "query_aggregate_claims":
        result = _handle_aggregate_claims(params)
    elif tool_name == "get_cost_trends":
        result = _handle_cost_trends(params)
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
            "min_cohort_size": 50,
            "aggregation_level": "population",
            "data_source": "pre-computed aggregates",
        },
    }


def _handle_aggregate_claims(params: dict) -> dict:
    diagnosis = params.get("diagnosis", "diabetes_t2")
    region = params.get("region", "northeast")
    date_range = params.get("date_range", "last_12m")

    cohort_size = random.randint(5000, 75000)
    base_cost = random.uniform(8000, 42000)

    return {
        "diagnosis_group": diagnosis,
        "region": region,
        "date_range": date_range,
        "cohort_size": cohort_size,
        "claims_summary": {
            "total_claims": random.randint(cohort_size * 3, cohort_size * 12),
            "unique_members": cohort_size,
            "avg_claims_per_member": round(random.uniform(3.2, 11.8), 1),
            "median_claim_amount": round(random.uniform(120, 850), 2),
        },
        "cost_metrics": {
            "total_cost_pmpm": round(base_cost / 12, 2),
            "annual_per_member": round(base_cost, 2),
            "inpatient_pct": round(random.uniform(25, 55), 1),
            "outpatient_pct": round(random.uniform(15, 35), 1),
            "pharmacy_pct": round(random.uniform(15, 40), 1),
            "emergency_pct": round(random.uniform(3, 12), 1),
        },
        "risk_stratification": {
            "high_risk_pct": round(random.uniform(8, 22), 1),
            "moderate_risk_pct": round(random.uniform(25, 40), 1),
            "low_risk_pct": round(random.uniform(40, 65), 1),
        },
        "yoy_change": {
            "cost_change_pct": round(random.uniform(-3.5, 14.2), 1),
            "utilization_change_pct": round(random.uniform(-5.0, 10.0), 1),
            "trend": random.choice(["increasing", "stable", "decreasing"]),
        },
        "privacy_notice": f"Aggregated across {cohort_size:,} members. k-anonymity enforced (k>=50).",
    }


def _handle_cost_trends(params: dict) -> dict:
    procedure = params.get("procedure", "knee_replacement")
    window = params.get("time_window", "quarterly")
    plan_type = params.get("plan_type", "all")

    base_procedural_cost = {
        "knee_replacement": (25000, 55000),
        "hip_replacement": (28000, 60000),
        "cardiac_catheterization": (15000, 40000),
        "colonoscopy": (1500, 4500),
        "mri_brain": (1000, 3500),
        "ct_abdomen": (500, 2500),
        "dialysis": (50000, 90000),
    }
    low, high = base_procedural_cost.get(procedure, (5000, 20000))

    periods = []
    period_labels = {
        "quarterly": [f"Q{q}-{y}" for y in [2024, 2025] for q in [1, 2, 3, 4]],
        "monthly": [f"2025-{m:02d}" for m in range(1, 13)],
        "annual": [str(y) for y in range(2020, 2026)],
    }

    labels = period_labels.get(window, period_labels["quarterly"])
    drift = 0
    for label in labels:
        drift += random.uniform(-0.02, 0.04)
        cost = random.uniform(low, high) * (1 + drift)
        periods.append({
            "period": label,
            "avg_cost": round(cost, 2),
            "volume": random.randint(200, 8000),
            "std_dev": round(cost * random.uniform(0.15, 0.35), 2),
        })

    return {
        "procedure": procedure,
        "plan_type": plan_type,
        "time_window": window,
        "trend_data": periods,
        "summary": {
            "overall_avg_cost": round(sum(p["avg_cost"] for p in periods) / len(periods), 2),
            "total_volume": sum(p["volume"] for p in periods),
            "cost_trend_direction": "increasing" if drift > 0.05 else ("decreasing" if drift < -0.05 else "stable"),
            "cost_cagr_pct": round(drift * 100 / max(len(periods), 1), 2),
        },
        "privacy_notice": "Facility-level minimum aggregation. No patient identifiers in output.",
    }
