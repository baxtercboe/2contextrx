# ContextRx — Privacy-Preserved Healthcare Context Marketplace

The world's first fully autonomous two-sided marketplace connecting healthcare data providers (payers/hospitals) with AI applications via **Model Context Protocol (MCP)**.

```
 ┌──────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
 │  PROVIDERS        │      │  ContextRx Platform   │      │  CONSUMERS        │
 │  (8 Healthcare    │◄────►│  ┌────────────────┐  │◄────►│  (4 AI Apps)      │
 │   Orgs)           │      │  │  MCP Proxy     │  │      │                   │
 │                   │      │  │  + Metering     │  │      │  HealthAI         │
 │  BlueCross        │      │  │  + Billing      │  │      │  ClaimsBot Pro    │
 │  NHDC             │      │  └────────────────┘  │      │  PopHealth        │
 │  MedInsight       │      │  ┌────────────────┐  │      │  MediScope AI     │
 │  Aetna            │      │  │  Autonomy      │  │      │                   │
 │  Cigna            │      │  │  Agent (ReAct)  │  │      │  [Next.js 15 UI]  │
 │  Humana           │      │  └────────────────┘  │      │                   │
 │  Kaiser           │      │                      │      │                   │
 │  UnitedHealth     │      │  [FastAPI + WS]      │      │                   │
 │                   │      │                      │      │                   │
 │  [18 MCP Tools]   │      │  [SQLite + SQLAlchemy]│     │                   │
 └──────────────────┘      └──────────────────────┘      └──────────────────┘
```

## Core Principles

- **Zero PHI exposure** — raw patient data never leaves provider environments
- **Pre-aggregated data only** — k-anonymity (k>=50) enforced at source
- **Usage-based billing** — per MCP tool call with transparent cost formulas
- **70/30 revenue split** — providers earn 70% + performance bonuses
- **Fully autonomous** — AI agent manages onboarding, pricing, and operations

## Features Demonstrated

| Feature | Description |
|---------|-------------|
| MCP Proxy Routing | Central `/api/mcp/invoke` endpoint routes to correct provider mock server |
| 3 Dedicated Mock MCP Servers | BlueCross, NHDC, MedInsight with realistic healthcare data responses |
| Real-time Metering | WebSocket `/ws/meter` broadcasts live transaction events |
| Cost Formula Engine | `consumer_cost = base_price x complexity_multiplier x volume_discount` |
| Provider Reward Engine | `payout = cost x 0.70 + uptime_bonus + quality_bonus` |
| Performance Bonuses | Uptime (3%), Quality (2%), Volume (2-8%), Freshness (2%) |
| Dynamic Take Rate | Platform take adjustable 25-35% via autonomy agent |
| ReAct Autonomy Agent | 4-tool agent: onboard, adjust_bonus, adjust_take, generate_report |
| Chain-of-Thought UI | Animated Thought > Tool Call > Observation reasoning chain |
| One-Click Onboarding | Instant provider/consumer registration with demo data |
| CSV Payout Export | Download detailed payout reports per provider |
| Privacy Compliance | HIPAA badges on every page, privacy banners, PHI disclaimers |
| Searchable Tool Catalog | Filter 18 MCP tools by category, search by name/description |
| Payout Simulator | Project monthly earnings based on volume and performance |
| 45 Seed Transactions | Pre-populated with varied cost/reward breakdowns across 8 providers |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + Recharts + Lucide Icons |
| Backend | FastAPI (Python) + WebSocket support |
| Database | SQLite via SQLAlchemy (auto-created on startup) |
| MCP Simulation | Mock MCP tool calls with realistic aggregated healthcare data |
| Autonomy | ReAct-style tool-calling agent with structured reasoning |
| Design | Dark mode healthcare-professional aesthetic (blues #0f62fe, purples #7c3aed) |

## Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.11+** and pip

### 1. Clone and install

```bash
git clone <repo-url> contextrx
cd contextrx
```

### 2. Start the backend

```bash
cd backend
pip install fastapi sqlalchemy pydantic uvicorn
uvicorn main:app --reload --port 8000
```

The API seeds automatically on first run (8 providers, 4 consumers, 45 transactions).

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### 4. Explore

1. **Landing Page** (`/`) — One-click "Become a Provider" or "Start Exploring" buttons
2. **Provider Portal** (`/provider`) — Earnings charts, payout simulator, CSV export
3. **Consumer Portal** (`/consumer`) — Tool catalog, query builder, cost receipts
4. **Autonomy Agent** (`/autonomy`) — Run AI agent cycles, watch chain-of-thought reasoning

## Deploy

### Frontend → Vercel

```bash
cd frontend
npx vercel
```

Set the environment variable for API proxy:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

Add to `next.config.js`:
```js
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` }]
}
```

### Backend → Railway / Render

**Railway:**
```bash
cd backend
railway init
railway up
```

**Render:**
1. Create a new Web Service pointing to `/backend`
2. Build command: `pip install fastapi sqlalchemy pydantic uvicorn`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

The SQLite database auto-creates and seeds on first boot — no external database needed for demo purposes.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers/` | List all providers |
| POST | `/api/providers/` | Register a new provider |
| GET | `/api/providers/{id}/tools` | Get provider's MCP tools |
| GET | `/api/providers/{id}/earnings-history` | Earnings over time for charts |
| GET | `/api/providers/{id}/export-csv` | Download payout report (CSV) |
| POST | `/api/providers/simulate-payout` | Simulate monthly payout |
| GET | `/api/consumers/` | List all consumers |
| GET | `/api/mcp/catalog` | Browse all available tools |
| POST | `/api/mcp/invoke` | Execute an MCP tool call via proxy |
| POST | `/api/mcp/query` | Backwards-compatible query endpoint |
| POST | `/api/autonomy/run-cycle` | Trigger full ReAct agent cycle |
| GET | `/api/autonomy/logs` | Get autonomy activity log |
| GET | `/api/autonomy/dashboard` | Platform metrics + take rate |
| GET | `/api/autonomy/tools` | List agent's available tools |
| GET | `/api/autonomy/take-rate` | Current platform/provider split |
| POST | `/api/onboarding/quick-provider` | One-click provider registration |
| POST | `/api/onboarding/quick-consumer` | One-click consumer registration |
| WS | `/ws/meter` | Real-time metering WebSocket |

## Privacy & Compliance

- **No raw PHI** is ever stored, transmitted, or returned
- All mock data represents **pre-aggregated statistics** across minimum 50-patient cohorts
- K-anonymity (k>=50) enforced at the data source level
- ContextRx acts purely as a **metering and routing proxy**
- HIPAA compliance badges displayed on every page
- Privacy banners with detailed explanations on provider and consumer portals

## Project Structure

```
contextrx/
├── backend/
│   ├── main.py                          # FastAPI app + WebSocket
│   ├── app/
│   │   ├── database.py                  # SQLite + SQLAlchemy setup
│   │   ├── seed.py                      # 8 providers, 4 consumers, 45 txns
│   │   ├── models/
│   │   │   ├── schemas.py               # SQLAlchemy models
│   │   │   └── pydantic_models.py       # Request/response models
│   │   ├── routes/
│   │   │   ├── providers.py             # Provider CRUD + CSV export
│   │   │   ├── consumers.py             # Consumer CRUD
│   │   │   ├── mcp_proxy.py             # Central MCP proxy routing
│   │   │   ├── autonomy.py              # Agent cycle + logs + metrics
│   │   │   └── onboarding.py            # One-click registration
│   │   ├── services/
│   │   │   ├── metering.py              # Cost/reward computation
│   │   │   └── autonomy_agent.py        # ReAct agent with 4 tools
│   │   └── mcp/
│   │       ├── mock_servers.py          # Generic mock MCP handlers
│   │       ├── provider_bluecross.py    # BlueCross MCP server
│   │       ├── provider_nhdc.py         # NHDC MCP server
│   │       └── provider_medinsight.py   # MedInsight MCP server
│   └── requirements.txt (optional)
├── frontend/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx               # Root layout + HIPAA footer
│   │   │   ├── globals.css              # Design system
│   │   │   ├── page.tsx                 # Landing page
│   │   │   ├── provider/page.tsx        # Provider dashboard
│   │   │   ├── consumer/page.tsx        # Consumer dashboard
│   │   │   └── autonomy/page.tsx        # Autonomy agent dashboard
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx           # Responsive nav
│   │   │   │   └── HIPAABar.tsx         # Global compliance footer
│   │   │   └── ui/                      # Reusable shadcn-style components
│   │   └── lib/
│   │       ├── api.ts                   # API client + TypeScript types
│   │       ├── utils.ts                 # Utilities
│   │       └── useWebSocketMeter.ts     # WebSocket hook
│   └── public/
└── README.md
```
