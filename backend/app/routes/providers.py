import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import secrets

from app.database import get_db
from app.models.schemas import Provider, MCPTool, Transaction
from app.models.pydantic_models import (
    ProviderCreate, ProviderResponse, MCPToolResponse,
    TransactionResponse, PayoutSimulation, PayoutSimulationRequest,
)
from app.services.metering import simulate_payout

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/", response_model=list[ProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    return db.query(Provider).all()


@router.get("/{provider_id}", response_model=ProviderResponse)
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.post("/", response_model=ProviderResponse)
def register_provider(req: ProviderCreate, db: Session = Depends(get_db)):
    api_key = f"crx_prov_{secrets.token_hex(16)}"
    provider = Provider(
        name=req.name,
        organization=req.organization,
        mcp_endpoint=req.mcp_endpoint,
        api_key=api_key,
        status="active",
        data_domains=json.dumps(req.data_domains),
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/{provider_id}/tools", response_model=list[MCPToolResponse])
def get_provider_tools(provider_id: int, db: Session = Depends(get_db)):
    return db.query(MCPTool).filter(MCPTool.provider_id == provider_id).all()


@router.get("/{provider_id}/transactions", response_model=list[TransactionResponse])
def get_provider_transactions(provider_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(Transaction)
        .filter(Transaction.provider_id == provider_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{provider_id}/earnings-history")
def get_earnings_history(provider_id: int, db: Session = Depends(get_db)):
    """Get earnings over time for charting — grouped by transaction."""
    txns = (
        db.query(Transaction)
        .filter(Transaction.provider_id == provider_id)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    cumulative = 0.0
    points = []
    for i, txn in enumerate(txns):
        cumulative += txn.provider_payout
        points.append({
            "index": i + 1,
            "earning": round(txn.provider_payout, 4),
            "cumulative": round(cumulative, 4),
            "tool": txn.tool_name,
            "timestamp": txn.created_at.isoformat() if txn.created_at else "",
        })
    return {
        "provider_id": provider_id,
        "total_earnings": round(cumulative, 4),
        "transaction_count": len(points),
        "data": points,
    }


@router.post("/simulate-payout", response_model=PayoutSimulation)
def simulate_provider_payout(req: PayoutSimulationRequest):
    return simulate_payout(req)


@router.get("/{provider_id}/export-csv")
def export_payout_csv(provider_id: int, db: Session = Depends(get_db)):
    """Download a CSV payout report for a provider's transaction history."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    txns = (
        db.query(Transaction)
        .filter(Transaction.provider_id == provider_id)
        .order_by(Transaction.created_at.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID", "Date", "Tool Name", "Consumer ID",
        "Base Cost", "Complexity Mult", "Volume Mult", "Total Cost",
        "Provider Base (70%)", "Uptime Bonus", "Quality Bonus",
        "Total Provider Payout", "Platform Fee", "Latency (ms)", "Status",
    ])

    cumulative = 0.0
    for txn in txns:
        cumulative += txn.provider_payout
        writer.writerow([
            txn.id,
            txn.created_at.isoformat() if txn.created_at else "",
            txn.tool_name,
            txn.consumer_id,
            f"{txn.base_cost:.4f}",
            f"{txn.complexity_multiplier:.2f}",
            f"{txn.volume_multiplier:.2f}",
            f"{txn.cost:.4f}",
            f"{txn.provider_base_payout:.4f}",
            f"{txn.uptime_bonus:.4f}",
            f"{txn.quality_bonus:.4f}",
            f"{txn.provider_payout:.4f}",
            f"{txn.platform_fee:.4f}",
            f"{txn.latency_ms:.1f}",
            txn.status,
        ])

    # Summary row
    writer.writerow([])
    writer.writerow(["TOTAL", "", "", "", "", "", "", "", "", "", "", f"{cumulative:.4f}", "", "", ""])

    output.seek(0)
    org_slug = provider.organization.lower().replace(" ", "_")
    filename = f"contextrx_payout_{org_slug}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
