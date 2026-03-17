"""
Central MCP proxy — routes context requests from consumers
to the appropriate provider's MCP server (mock).
"""

import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import MCPTool, Consumer
from app.models.pydantic_models import MCPQueryRequest, MCPQueryResponse, MCPToolResponse
from app.mcp.mock_servers import execute_mock_mcp_tool
from app.services.metering import record_transaction

router = APIRouter(prefix="/api/mcp", tags=["mcp-proxy"])


@router.get("/catalog", response_model=list[MCPToolResponse])
def get_tool_catalog(db: Session = Depends(get_db)):
    """Browse all available MCP tools across providers."""
    return db.query(MCPTool).filter(MCPTool.is_active == True).all()


@router.post("/query", response_model=MCPQueryResponse)
def execute_query(req: MCPQueryRequest, db: Session = Depends(get_db)):
    """Execute an MCP tool call through the proxy."""
    # Find the tool
    tool = db.query(MCPTool).filter(MCPTool.name == req.tool_name, MCPTool.is_active == True).first()
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{req.tool_name}' not found or inactive")

    # Validate consumer
    consumer = db.query(Consumer).filter(Consumer.id == req.consumer_id).first()
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")

    # Execute mock MCP call with latency tracking
    start = time.time()
    result = execute_mock_mcp_tool(req.tool_name, req.parameters)
    latency_ms = round((time.time() - start) * 1000 + 45, 1)  # Add simulated network latency

    # Record transaction and meter usage
    cost = tool.price_per_call
    txn = record_transaction(
        db=db,
        provider_id=tool.provider_id,
        consumer_id=req.consumer_id,
        tool_name=req.tool_name,
        cost=cost,
        latency_ms=latency_ms,
    )

    return MCPQueryResponse(
        tool_name=req.tool_name,
        result=result,
        cost=txn.cost,
        provider_payout=txn.provider_payout,
        platform_fee=txn.platform_fee,
        latency_ms=latency_ms,
    )
