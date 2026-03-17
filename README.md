# ContextRx — Privacy-Preserved Healthcare Context Marketplace

The world's first fully autonomous two-sided marketplace connecting healthcare data providers (payers/hospitals) with AI applications via **Model Context Protocol (MCP)**.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Context         │     │   ContextRx       │     │  Context         │
│  Providers       │◄───►│   MCP Proxy       │◄───►│  Consumers       │
│  (Payers/        │     │   + Metering      │     │  (AI Apps)       │
│   Hospitals)     │     │   + Autonomy      │     │                  │
│                  │     │   Agent           │     │                  │
│  [MCP Servers]   │     │   [FastAPI]       │     │  [Next.js UI]    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Core Rules:**
- Raw PHI never leaves provider environments
- All data is pre-aggregated (k-anonymity, k≥50)
- Usage-based billing: per MCP tool call
- Revenue split: 70% provider / 30% platform
- Performance bonuses for uptime, quality, volume, and data freshness

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + Lucide Icons |
| Backend | FastAPI (Python) + WebSocket support |
| Database | SQLite via SQLAlchemy |
| MCP Simulation | Mock MCP tool calls with realistic healthcare data |
| Autonomy | Rule-based agent (LangChain-ready) |

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Views

### Landing Page (`/`)
Mission statement, architecture overview, and CTA buttons.

### Provider Portal (`/provider`)
- View registered MCP servers and their status
- Monitor live earnings, uptime/quality scores
- Browse registered MCP tools with call counts and latency
- Payout simulator with performance bonus calculation

### Consumer Portal (`/consumer`)
- Browse the full context catalog of available MCP tools
- Run example queries (diabetes trends, cohort costs, drug utilization, etc.)
- Real-time cost breakdown per query (total cost, provider payout, platform fee)
- Query history tracking

### Autonomy Dashboard (`/autonomy`)
- Watch the AI agent run decision cycles in real-time
- Auto-onboard new providers
- Dynamic pricing adjustments based on demand
- Provider score updates
- Platform-wide metrics and revenue distribution

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers/` | List all providers |
| POST | `/api/providers/` | Register a new provider |
| GET | `/api/providers/{id}/tools` | Get provider's MCP tools |
| POST | `/api/providers/simulate-payout` | Simulate monthly payout |
| GET | `/api/consumers/` | List all consumers |
| GET | `/api/mcp/catalog` | Browse all available tools |
| POST | `/api/mcp/query` | Execute an MCP tool call |
| POST | `/api/autonomy/run-cycle` | Trigger autonomy agent cycle |
| GET | `/api/autonomy/logs` | Get autonomy activity log |
| GET | `/api/autonomy/dashboard` | Get platform metrics |
| WS | `/ws/metering` | Real-time metering WebSocket |

## Privacy & Compliance

- **No raw PHI** is ever stored, transmitted, or returned
- All mock data represents **pre-aggregated statistics** across minimum 50-patient cohorts
- K-anonymity (k≥50) enforced at the data source level
- ContextRx acts purely as a **metering and routing proxy**

## Logo

Place your ContextRx logo at `frontend/public/logo.svg`. The navbar currently uses a text-based logo: **Context**Rx with a gradient icon placeholder.
