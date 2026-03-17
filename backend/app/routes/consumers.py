from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import secrets

from app.database import get_db
from app.models.schemas import Consumer, Transaction
from app.models.pydantic_models import ConsumerCreate, ConsumerResponse, TransactionResponse

router = APIRouter(prefix="/api/consumers", tags=["consumers"])


@router.get("/", response_model=list[ConsumerResponse])
def list_consumers(db: Session = Depends(get_db)):
    return db.query(Consumer).all()


@router.get("/{consumer_id}", response_model=ConsumerResponse)
def get_consumer(consumer_id: int, db: Session = Depends(get_db)):
    consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")
    return consumer


@router.post("/", response_model=ConsumerResponse)
def register_consumer(req: ConsumerCreate, db: Session = Depends(get_db)):
    api_key = f"crx_cons_{secrets.token_hex(16)}"
    consumer = Consumer(
        name=req.name,
        organization=req.organization,
        api_key=api_key,
        plan=req.plan,
    )
    db.add(consumer)
    db.commit()
    db.refresh(consumer)
    return consumer


@router.get("/{consumer_id}/transactions", response_model=list[TransactionResponse])
def get_consumer_transactions(consumer_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(Transaction)
        .filter(Transaction.consumer_id == consumer_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
