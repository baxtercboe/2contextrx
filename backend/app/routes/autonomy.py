from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.schemas import AutonomyLog, Provider, Consumer, Transaction
from app.models.pydantic_models import AutonomyLogResponse, DashboardMetrics
from app.services.autonomy_agent import run_autonomy_cycle

router = APIRouter(prefix="/api/autonomy", tags=["autonomy"])


@router.post("/run-cycle")
def trigger_cycle(db: Session = Depends(get_db)):
    """Manually trigger one autonomy agent cycle."""
    actions = run_autonomy_cycle(db)
    return {"cycle_actions": actions, "action_count": len(actions)}


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
    total_consumers = db.query(Consumer).count()
    total_queries = db.query(Transaction).count()
    total_revenue = db.query(func.sum(Transaction.cost)).scalar() or 0.0
    platform_earnings = db.query(func.sum(Transaction.platform_fee)).scalar() or 0.0
    provider_payouts = db.query(func.sum(Transaction.provider_payout)).scalar() or 0.0
    avg_latency = db.query(func.avg(Transaction.latency_ms)).scalar() or 0.0

    return DashboardMetrics(
        total_providers=total_providers,
        total_consumers=total_consumers,
        total_queries=total_queries,
        total_revenue=round(float(total_revenue), 2),
        platform_earnings=round(float(platform_earnings), 2),
        provider_payouts=round(float(provider_payouts), 2),
        avg_latency_ms=round(float(avg_latency), 1),
        uptime_percent=99.9,
    )
