from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    mcp_endpoint = Column(String(512), nullable=False)
    api_key = Column(String(128), nullable=False)
    status = Column(String(50), default="pending")  # pending, active, suspended
    data_domains = Column(Text, default="[]")  # JSON list of domains
    uptime_score = Column(Float, default=100.0)
    quality_score = Column(Float, default=95.0)
    total_earnings = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tools = relationship("MCPTool", back_populates="provider")
    transactions = relationship("Transaction", back_populates="provider")


class Consumer(Base):
    __tablename__ = "consumers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=False)
    api_key = Column(String(128), nullable=False)
    plan = Column(String(50), default="pay-as-you-go")  # pay-as-you-go, enterprise
    total_spent = Column(Float, default=0.0)
    query_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transactions = relationship("Transaction", back_populates="consumer")


class MCPTool(Base):
    __tablename__ = "mcp_tools"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    input_schema = Column(Text, nullable=False)  # JSON schema
    price_per_call = Column(Float, default=0.05)
    category = Column(String(100), default="general")
    call_count = Column(Integer, default=0)
    avg_latency_ms = Column(Float, default=150.0)
    is_active = Column(Boolean, default=True)

    provider = relationship("Provider", back_populates="tools")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    consumer_id = Column(Integer, ForeignKey("consumers.id"), nullable=False)
    tool_name = Column(String(255), nullable=False)
    session_id = Column(String(128), nullable=True)

    # Cost breakdown components
    base_cost = Column(Float, nullable=False)  # base price_per_call
    complexity_multiplier = Column(Float, default=1.0)  # 1.0–2.5x based on param complexity
    volume_multiplier = Column(Float, default=1.0)  # discount tiers for high volume
    cost = Column(Float, nullable=False)  # final consumer cost = base * complexity * volume

    # Revenue split
    provider_base_payout = Column(Float, nullable=False)  # cost * 0.70
    uptime_bonus = Column(Float, default=0.0)
    quality_bonus = Column(Float, default=0.0)
    provider_payout = Column(Float, nullable=False)  # base_payout + bonuses
    platform_fee = Column(Float, nullable=False)  # cost - provider_payout

    latency_ms = Column(Float, default=0.0)
    status = Column(String(50), default="completed")
    routed_to_endpoint = Column(String(512), nullable=True)  # which provider endpoint was hit
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    provider = relationship("Provider", back_populates="transactions")
    consumer = relationship("Consumer", back_populates="transactions")


class AutonomyLog(Base):
    __tablename__ = "autonomy_logs"

    id = Column(Integer, primary_key=True, index=True)
    cycle_number = Column(Integer, nullable=False)
    action_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    details = Column(Text, default="{}")  # JSON details
    impact = Column(String(50), default="neutral")  # positive, neutral, negative
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PlatformMetrics(Base):
    __tablename__ = "platform_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    total_queries = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    active_providers = Column(Integer, default=0)
    active_consumers = Column(Integer, default=0)
    avg_latency_ms = Column(Float, default=0.0)
    uptime_percent = Column(Float, default=99.9)
