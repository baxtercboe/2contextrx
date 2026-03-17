from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProviderCreate(BaseModel):
    name: str
    organization: str
    mcp_endpoint: str
    data_domains: list[str] = []


class ProviderResponse(BaseModel):
    id: int
    name: str
    organization: str
    mcp_endpoint: str
    api_key: str
    status: str
    data_domains: str
    uptime_score: float
    quality_score: float
    total_earnings: float
    created_at: datetime

    class Config:
        from_attributes = True


class ConsumerCreate(BaseModel):
    name: str
    organization: str
    plan: str = "pay-as-you-go"


class ConsumerResponse(BaseModel):
    id: int
    name: str
    organization: str
    api_key: str
    plan: str
    total_spent: float
    query_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class MCPToolResponse(BaseModel):
    id: int
    provider_id: int
    name: str
    description: str
    input_schema: str
    price_per_call: float
    category: str
    call_count: int
    avg_latency_ms: float
    is_active: bool

    class Config:
        from_attributes = True


class MCPQueryRequest(BaseModel):
    tool_name: str
    consumer_id: int
    parameters: dict = {}


class MCPQueryResponse(BaseModel):
    tool_name: str
    result: dict
    cost: float
    provider_payout: float
    platform_fee: float
    latency_ms: float
    phi_disclaimer: str = "No raw PHI was accessed or returned. All data is pre-aggregated."


class TransactionResponse(BaseModel):
    id: int
    provider_id: int
    consumer_id: int
    tool_name: str
    cost: float
    provider_payout: float
    platform_fee: float
    latency_ms: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AutonomyLogResponse(BaseModel):
    id: int
    cycle_number: int
    action_type: str
    description: str
    details: str
    impact: str
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardMetrics(BaseModel):
    total_providers: int
    total_consumers: int
    total_queries: int
    total_revenue: float
    platform_earnings: float
    provider_payouts: float
    avg_latency_ms: float
    uptime_percent: float


class PayoutSimulation(BaseModel):
    base_payout: float
    uptime_bonus: float
    quality_bonus: float
    volume_bonus: float
    freshness_bonus: float
    total_payout: float
    platform_fee: float


class PayoutSimulationRequest(BaseModel):
    monthly_queries: int = 10000
    uptime_score: float = 99.5
    quality_score: float = 95.0
    price_per_call: float = 0.05
