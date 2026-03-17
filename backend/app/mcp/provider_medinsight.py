"""
Dedicated Mock MCP Provider Server: MedInsight Analytics
Specializes in: regional utilization trends, service-line analytics, telehealth metrics.
"""

import random
import time
from fastapi import APIRouter

router = APIRouter(prefix="/api/mock-providers/medinsight", tags=["mock-provider-medinsight"])

PROVIDER_ID = "medinsight_analytics"
PROVIDER_META = {
    "name": "MedInsight Analytics MCP Server",
    "version": "1.8.3",
    "protocol": "mcp/1.0",
    "privacy_level": "aggregated_only",
    "min_cohort_size": 50,
    "data_freshness": "bi-weekly",
    "endpoint_slug": "medinsight",
}


@router.get("/health")
def health():
    return {"status": "healthy", "provider": PROVIDER_ID, "uptime_pct": 99.9}


@router.get("/capabilities")
def capabilities():
    return {
        "provider": PROVIDER_META,
        "tools": [
            {
                "name": "get_regional_trend_query",
                "description": "Healthcare utilization trends by state and service type. "
                               "Tracks monthly volumes, costs, and trend direction.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "state": {"type": "string"},
                        "service_type": {
                            "type": "string",
                            "enum": ["inpatient", "outpatient", "emergency", "pharmacy", "telehealth"],
                        },
                        "year": {"type": "integer", "minimum": 2023, "maximum": 2025},
                    },
                    "required": ["state", "service_type"],
                },
            },
            {
                "name": "get_service_line_benchmarks",
                "description": "Benchmark comparison data across service lines — "
                               "length of stay, cost per case, readmission rates by facility tier.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "service_line": {
                            "type": "string",
                            "enum": ["cardiology", "orthopedics", "oncology", "maternity", "behavioral_health"],
                        },
                        "facility_tier": {
                            "type": "string",
                            "enum": ["academic_center", "community", "rural_access", "all"],
                        },
                    },
                    "required": ["service_line"],
                },
            },
        ],
    }


@router.post("/invoke")
def invoke_tool(request: dict):
    tool_name = request.get("tool_name", "")
    params = request.get("parameters", {})

    start = time.time()

    if tool_name == "get_regional_trend_query":
        result = _handle_regional_trend(params)
    elif tool_name == "get_service_line_benchmarks":
        result = _handle_service_benchmarks(params)
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
            "aggregation_level": "geographic_region",
            "data_source": "pre-computed aggregates",
        },
    }


def _handle_regional_trend(params: dict) -> dict:
    state = params.get("state", "CA")
    service = params.get("service_type", "outpatient")
    year = params.get("year", 2025)

    months = []
    base_util = random.uniform(80, 350)
    base_cost = random.uniform(300, 4000)
    for m in range(1, 13):
        seasonal = 1.0 + 0.1 * (1 if m in [1, 2, 12] else (-0.05 if m in [6, 7, 8] else 0))
        months.append({
            "month": f"{year}-{m:02d}",
            "utilization_per_1000": round(base_util * seasonal * random.uniform(0.9, 1.1), 1),
            "avg_cost_per_visit": round(base_cost * random.uniform(0.85, 1.15), 2),
            "total_encounters": random.randint(5000, 80000),
        })

    total_util = sum(m["utilization_per_1000"] for m in months)
    avg_cost = sum(m["avg_cost_per_visit"] for m in months) / 12

    return {
        "state": state,
        "service_type": service,
        "year": year,
        "monthly_data": months,
        "annual_summary": {
            "total_utilization_per_1000": round(total_util, 1),
            "avg_cost_per_visit": round(avg_cost, 2),
            "total_encounters": sum(m["total_encounters"] for m in months),
            "trend_direction": random.choice(["increasing", "stable", "decreasing"]),
            "yoy_utilization_change_pct": round(random.uniform(-8.0, 15.0), 1),
            "yoy_cost_change_pct": round(random.uniform(-3.0, 12.0), 1),
        },
        "privacy_notice": "County-level minimum aggregation. No facility- or patient-level data.",
    }


def _handle_service_benchmarks(params: dict) -> dict:
    service_line = params.get("service_line", "cardiology")
    facility = params.get("facility_tier", "all")

    facility_tiers = ["academic_center", "community", "rural_access"] if facility == "all" else [facility]

    benchmarks = []
    for tier in facility_tiers:
        benchmarks.append({
            "facility_tier": tier,
            "avg_length_of_stay_days": round(random.uniform(1.5, 8.5), 1),
            "avg_cost_per_case": round(random.uniform(5000, 85000), 2),
            "30day_readmission_rate_pct": round(random.uniform(4.0, 18.0), 1),
            "mortality_rate_pct": round(random.uniform(0.5, 6.0), 2),
            "patient_satisfaction_score": round(random.uniform(3.2, 4.9), 1),
            "case_volume": random.randint(500, 25000),
            "facility_count": random.randint(10, 300),
        })

    return {
        "service_line": service_line,
        "facility_tier_filter": facility,
        "benchmarks": benchmarks,
        "national_reference": {
            "avg_cost_per_case": round(random.uniform(15000, 55000), 2),
            "avg_los": round(random.uniform(2.5, 6.0), 1),
            "avg_readmission_rate": round(random.uniform(8.0, 14.0), 1),
        },
        "privacy_notice": "Aggregated across facility networks. No facility identifiers in output.",
    }
