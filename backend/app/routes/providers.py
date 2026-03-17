from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/simulate-payout", response_model=PayoutSimulation)
def simulate_provider_payout(req: PayoutSimulationRequest):
    return simulate_payout(req)
