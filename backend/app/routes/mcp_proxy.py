"""
Central MCP proxy — routes context requests from consumers
to the correct provider's MCP server endpoint.

Supports two entry points:
  POST /api/mcp/invoke  — MCP-format invoke (tool_name, parameters, session_id)
  POST /api/mcp/query   — Original query format (backwards-compatible)
"""

import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import MCPTool, Consumer, Provider
from app.models.pydantic_models import (
    MCPInvokeRequest, MCPQueryRequest, MCPQueryResponse,
    MCPToolResponse, CostBreakdown, RewardBreakdown,
)
from app.mcp.mock_servers import execute_mock_mcp_tool
from app.services.metering import record_transaction

router = APIRouter(prefix="/api/mcp", tags=["mcp-proxy"])

# Internal route map: provider DB endpoint slug → local mock route
# In production these would be real external URLs
PROVIDER_ROUTE_MAP = {
    "bcbs-mcp.contextrx.io": "/api/mock-providers/bluecross/invoke",
    "nhdc-mcp.contextrx.io": "/api/mock-providers/nhdc/invoke",
    "medinsight-mcp.contextrx.io": "/api/mock-providers/medinsight/invoke",
}


def _resolve_provider_endpoint(mcp_endpoint: str) -> str | None:
    """Extract the host from a provider's MCP endpoint and map to local mock route."""
    for host_pattern, local_route in PROVIDER_ROUTE_MAP.items():
        if host_pattern in mcp_endpoint:
            return local_route
    return None


@router.get("/catalog", response_model=list[MCPToolResponse])
def get_tool_catalog(db: Session = Depends(get_db)):
    """Browse all available MCP tools across providers."""
    return db.query(MCPTool).filter(MCPTool.is_active == True).all()


@router.get("/catalog/{tool_name}")
def get_tool_detail(tool_name: str, db: Session = Depends(get_db)):
    """Get details of a specific tool including provider info."""
    tool = db.query(MCPTool).filter(MCPTool.name == tool_name, MCPTool.is_active == True).first()
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    provider = db.query(Provider).filter(Provider.id == tool.provider_id).first()
    return {
        "tool": {
            "id": tool.id,
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
            "price_per_call": tool.price_per_call,
            "category": tool.category,
            "call_count": tool.call_count,
            "avg_latency_ms": tool.avg_latency_ms,
        },
        "provider": {
            "id": provider.id if provider else None,
            "organization": provider.organization if provider else "Unknown",
            "endpoint": provider.mcp_endpoint if provider else None,
            "uptime_score": provider.uptime_score if provider else 0,
            "quality_score": provider.quality_score if provider else 0,
        },
    }


@router.post("/invoke", response_model=MCPQueryResponse)
def mcp_invoke(req: MCPInvokeRequest, db: Session = Depends(get_db)):
    """
    Central MCP proxy invoke endpoint.
    Accepts MCP-format requests, routes to the correct provider, meters usage.
    """
    return _execute_proxied_call(
        tool_name=req.tool_name,
        consumer_id=req.consumer_id,
        parameters=req.parameters,
        session_id=req.session_id,
        db=db,
    )


@router.post("/query", response_model=MCPQueryResponse)
def execute_query(req: MCPQueryRequest, db: Session = Depends(get_db)):
    """Backwards-compatible query endpoint."""
    return _execute_proxied_call(
        tool_name=req.tool_name,
        consumer_id=req.consumer_id,
        parameters=req.parameters,
        session_id=req.session_id,
        db=db,
    )


def _execute_proxied_call(
    tool_name: str,
    consumer_id: int,
    parameters: dict,
    session_id: str | None,
    db: Session,
) -> MCPQueryResponse:
    """Core proxy logic: route → execute → meter → return."""

    # 1. Resolve tool
    tool = db.query(MCPTool).filter(MCPTool.name == tool_name, MCPTool.is_active == True).first()
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found or inactive")

    # 2. Validate consumer
    consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")

    # 3. Resolve provider + endpoint
    provider = db.query(Provider).filter(Provider.id == tool.provider_id).first()
    if not provider:
        raise HTTPException(status_code=500, detail="Provider not found for tool")

    routed_endpoint = _resolve_provider_endpoint(provider.mcp_endpoint)
    session_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"

    # 4. Execute the call — route to dedicated mock server if available, else generic
    start = time.time()

    if routed_endpoint:
        # Call the dedicated mock provider's /invoke endpoint locally
        # In production this would be an HTTP call to the external provider
        from app.mcp.provider_bluecross import invoke_tool as bc_invoke
        from app.mcp.provider_nhdc import invoke_tool as nhdc_invoke
        from app.mcp.provider_medinsight import invoke_tool as mi_invoke

        invoke_map = {
            "/api/mock-providers/bluecross/invoke": bc_invoke,
            "/api/mock-providers/nhdc/invoke": nhdc_invoke,
            "/api/mock-providers/medinsight/invoke": mi_invoke,
        }

        invoke_fn = invoke_map.get(routed_endpoint)
        if invoke_fn:
            provider_response = invoke_fn({"tool_name": tool_name, "parameters": parameters})
            result = provider_response.get("result", provider_response)
        else:
            result = execute_mock_mcp_tool(tool_name, parameters)
    else:
        # Fallback to the generic mock server
        result = execute_mock_mcp_tool(tool_name, parameters)

    # Simulate realistic network latency
    processing_ms = (time.time() - start) * 1000
    network_latency = 35 + (hash(tool_name) % 60)  # deterministic per-tool simulated latency
    latency_ms = round(processing_ms + network_latency, 1)

    # 5. Meter and record
    txn, cost_bd, reward_bd = record_transaction(
        db=db,
        provider_id=provider.id,
        consumer_id=consumer_id,
        tool_name=tool_name,
        parameters=parameters,
        latency_ms=latency_ms,
        session_id=session_id,
        routed_to_endpoint=routed_endpoint or provider.mcp_endpoint,
    )

    # 6. Return full response with math breakdowns
    return MCPQueryResponse(
        tool_name=tool_name,
        result=result,
        cost=cost_bd.final_cost,
        cost_breakdown=cost_bd,
        reward_breakdown=reward_bd,
        provider_payout=reward_bd.total_provider_payout,
        platform_fee=reward_bd.platform_fee,
        latency_ms=latency_ms,
        routed_to=provider.mcp_endpoint,
        session_id=session_id,
    )
