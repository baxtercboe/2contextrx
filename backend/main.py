import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import init_db, SessionLocal
from app.routes import providers, consumers, mcp_proxy, autonomy, onboarding
from app.mcp import provider_bluecross, provider_nhdc, provider_medinsight
from app.seed import seed_database
from app.services.autonomy_agent import run_autonomy_cycle
from app.models.schemas import MCPTool, Consumer, Provider
from app.mcp.mock_servers import execute_mock_mcp_tool
from app.services.metering import record_transaction


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="ContextRx API",
    description="Two-sided marketplace for privacy-preserved healthcare context via MCP",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers — core API
app.include_router(providers.router)
app.include_router(consumers.router)
app.include_router(mcp_proxy.router)
app.include_router(autonomy.router)
app.include_router(onboarding.router)

# Register dedicated mock provider MCP servers
app.include_router(provider_bluecross.router)
app.include_router(provider_nhdc.router)
app.include_router(provider_medinsight.router)


@app.get("/")
def root():
    return {
        "service": "ContextRx API",
        "version": "0.2.0",
        "status": "operational",
        "docs": "/docs",
        "mcp_proxy": "/api/mcp/invoke",
        "mock_providers": [
            "/api/mock-providers/bluecross/capabilities",
            "/api/mock-providers/nhdc/capabilities",
            "/api/mock-providers/medinsight/capabilities",
        ],
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": time.time()}


# ─── WebSocket: Real-time Metering ───────────────────────────────────────────

class MeterConnectionManager:
    """Manages WebSocket connections for real-time meter events."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

    @property
    def count(self) -> int:
        return len(self.active_connections)


meter_manager = MeterConnectionManager()

# Export so routes can broadcast
app.state.meter_manager = meter_manager


@app.websocket("/ws/meter")
async def meter_websocket(websocket: WebSocket):
    """
    Real-time metering WebSocket.
    Clients connect to receive live transaction events.
    Clients can also send commands:
      {"type": "execute_query", "tool_name": "...", "consumer_id": N, "parameters": {...}}
      {"type": "run_autonomy_cycle"}
    """
    await meter_manager.connect(websocket)

    # Send welcome with connection count
    await websocket.send_json({
        "type": "connected",
        "active_connections": meter_manager.count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "execute_query":
                # Execute an MCP query and broadcast the meter event
                db = SessionLocal()
                try:
                    tool_name = msg["tool_name"]
                    consumer_id = msg["consumer_id"]
                    parameters = msg.get("parameters", {})
                    session_id = msg.get("session_id")

                    tool = db.query(MCPTool).filter(
                        MCPTool.name == tool_name, MCPTool.is_active == True
                    ).first()
                    consumer = db.query(Consumer).filter(Consumer.id == consumer_id).first()
                    provider = db.query(Provider).filter(Provider.id == tool.provider_id).first() if tool else None

                    if not tool or not consumer or not provider:
                        await websocket.send_json({"type": "error", "detail": "Invalid tool/consumer"})
                        continue

                    start = time.time()
                    result = execute_mock_mcp_tool(tool_name, parameters)
                    latency_ms = round((time.time() - start) * 1000 + 45, 1)

                    txn, cost_bd, reward_bd = record_transaction(
                        db=db,
                        provider_id=provider.id,
                        consumer_id=consumer_id,
                        tool_name=tool_name,
                        parameters=parameters,
                        latency_ms=latency_ms,
                        session_id=session_id,
                        routed_to_endpoint=provider.mcp_endpoint,
                    )

                    # Build meter event
                    meter_event = {
                        "type": "transaction",
                        "transaction_id": txn.id,
                        "tool_name": tool_name,
                        "consumer_id": consumer_id,
                        "consumer_name": consumer.name,
                        "provider_id": provider.id,
                        "provider_name": provider.organization,
                        "cost_breakdown": {
                            "base_cost": cost_bd.base_cost,
                            "complexity_multiplier": cost_bd.complexity_multiplier,
                            "volume_multiplier": cost_bd.volume_multiplier,
                            "final_cost": cost_bd.final_cost,
                            "formula": cost_bd.formula,
                        },
                        "reward_breakdown": {
                            "provider_base_payout": reward_bd.provider_base_payout,
                            "uptime_bonus": reward_bd.uptime_bonus,
                            "quality_bonus": reward_bd.quality_bonus,
                            "total_provider_payout": reward_bd.total_provider_payout,
                            "platform_fee": reward_bd.platform_fee,
                            "formula": reward_bd.formula,
                        },
                        "latency_ms": latency_ms,
                        "routed_to": provider.mcp_endpoint,
                        "result": result,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

                    # Broadcast to ALL connected clients
                    await meter_manager.broadcast(meter_event)

                finally:
                    db.close()

            elif msg_type == "run_autonomy_cycle":
                db = SessionLocal()
                try:
                    actions = run_autonomy_cycle(db)
                    await meter_manager.broadcast({
                        "type": "autonomy_update",
                        "actions": actions,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                finally:
                    db.close()

            elif msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "active_connections": meter_manager.count,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        meter_manager.disconnect(websocket)


# Keep the old endpoint as alias for backwards compat
@app.websocket("/ws/metering")
async def metering_websocket_compat(websocket: WebSocket):
    """Backwards-compatible alias for /ws/meter."""
    await meter_websocket(websocket)
