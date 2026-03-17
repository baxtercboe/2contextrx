import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.routes import providers, consumers, mcp_proxy, autonomy
from app.seed import seed_database
from app.services.autonomy_agent import run_autonomy_cycle


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
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(providers.router)
app.include_router(consumers.router)
app.include_router(mcp_proxy.router)
app.include_router(autonomy.router)


@app.get("/")
def root():
    return {
        "service": "ContextRx API",
        "version": "0.1.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": time.time()}


# WebSocket for real-time metering updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/metering")
async def metering_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "run_autonomy_cycle":
                db = SessionLocal()
                try:
                    actions = run_autonomy_cycle(db)
                    await manager.broadcast({
                        "type": "autonomy_update",
                        "actions": actions,
                    })
                finally:
                    db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
