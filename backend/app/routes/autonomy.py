from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.schemas import AutonomyLog, Provider, Consumer, Transaction
from app.models.pydantic_models import AutonomyLogResponse, DashboardMetrics
from app.services.autonomy_agent import (
    run_autonomy_cycle, get_platform_take_rate, set_platform_take_rate,
    AGENT_TOOLS,
)

router = APIRouter(prefix="/api/autonomy", tags=["autonomy"])


@router.post("/run-cycle")
def trigger_cycle(db: Session = Depends(get_db)):
    """Manually trigger one full ReAct agent cycle. Returns structured thoughts + actions."""
    result = run_autonomy_cycle(db)
    return result


@router.get("/logs", response_model=list[AutonomyLogResponse])
def get_logs(limit: int = 100, db: Session = Depends(get_db)):
    return (
        db.query(AutonomyLog)
        .order_by(AutonomyLog.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard(db: Session = Depends(get_db)):
    total_providers = db.query(Provider).count()
    active_providers = db.query(Provider).filter(Provider.status == "active").count()
    total_consumers = db.query(Consumer).count()
    total_queries = db.query(Transaction).count()
    total_revenue = db.query(func.sum(Transaction.cost)).scalar() or 0.0
    platform_earnings = db.query(func.sum(Transaction.platform_fee)).scalar() or 0.0
    provider_payouts = db.query(func.sum(Transaction.provider_payout)).scalar() or 0.0
    avg_latency = db.query(func.avg(Transaction.latency_ms)).scalar() or 0.0

    return DashboardMetrics(
        total_providers=total_providers,
        active_providers=active_providers,
        total_consumers=total_consumers,
        total_queries=total_queries,
        total_revenue=round(float(total_revenue), 2),
        platform_earnings=round(float(platform_earnings), 2),
        provider_payouts=round(float(provider_payouts), 2),
        avg_latency_ms=round(float(avg_latency), 1),
        uptime_percent=99.9,
        platform_take_rate=round(get_platform_take_rate() * 100, 1),
    )


@router.get("/take-rate")
def get_take_rate():
    """Get current platform take rate."""
    rate = get_platform_take_rate()
    return {
        "take_rate": round(rate, 4),
        "take_rate_pct": round(rate * 100, 1),
        "provider_share_pct": round((1 - rate) * 100, 1),
    }


@router.get("/tools")
def get_agent_tools():
    """List all tools available to the autonomy agent."""
    return [
        {
            "name": name,
            "description": info["description"],
            "parameters": info["parameters"],
        }
        for name, info in AGENT_TOOLS.items()
    ]
