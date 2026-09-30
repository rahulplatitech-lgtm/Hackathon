# Crisis Command AI

## Multi-Agent Emergency Response & Resource Coordination Platform

> ⚠️ **PROTOTYPE** — Simulated emergency coordination only. Not for real emergency use.

### Architecture

```
User (Chat/Voice/GPS)
        │
        ▼
Agent 1: Emergency Intake ──→ Agent 2: Distress & Confidence
        │                              │
        │              ┌───────────────┴───────────────┐
        │              │                               │
        │        High Confidence               Low Confidence
        │              │                               │
        │              │                    Agent 3: Human Escalation
        │              │                               │
        │              └───────────────┬───────────────┘
        │                              │
        ▼                              ▼
Agent 4: Incident Assessment ──→ Agent 5: Priority Triage
        │
        ▼
Agent 6: Resource Allocation (OR-Tools) ──→ Agent 7: Route/Logistics
        │
        ▼
Agent 8: Command Planning ──→ Dashboard
        │
        ▼
Agent 9: Monitoring ──→ Agent 10: Dynamic Replanning
```

### Quick Start

```bash
# 1. Install backend
cd backend
pip install -r requirements.txt
cp .env.example .env

# 2. Start backend
python -m uvicorn app.main:app --reload --port 8000

# 3. Install frontend (new terminal)
cd frontend
npm install

# 4. Start frontend
npm run dev
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Google Maps |
| Backend | Python 3.10+, FastAPI, Pydantic, SQLAlchemy |
| Optimization | Google OR-Tools (CP-SAT linear solver) |
| ML | XGBoost, Random Forest, Federated Learning (FedAvg/SGD) |
| AI | Gemini API with conversational voice assistant |
| Database | SQLite (easily swappable to PostgreSQL) |
| Real-time | WebSocket |
| Maps | Google Maps JavaScript API (@vis.gl/react-google-maps) |

### Pages

- `/` — Landing page & mission briefing
- `/report` — Emergency reporting (SOS voice assistant, text)
- `/operator` — Human operator verification console
- `/command` — **Main Command Center** (interactive map, incidents, fleet telemetry, response plan)
- `/simulation` — Scenario simulation & stress-testing controller

### Demo Procedure

1. Open `/simulation` — click **Seed Data** (loads 3 incidents + 14 resources with guaranteed backup reserves)
2. Click **Generate Plan** (OR-Tools allocates resources minimizing transit delay)
3. Open `/command` — see distinct pins for incidents, standby units, dispatched vehicles, and active route lines with ETAs
4. Back to `/simulation` — click **Add Critical Incident** (Severity 5)
5. Click **Breakdown A2** (ambulance mechanical failure)
6. Click **Dynamic Replan** — system reassesses and generates new plan
7. Check `/command` — see plan diffs (old vs new), explanation, and updated routes

### Environment Variables

Backend (`backend/.env`):
```
DATABASE_URL=sqlite+aiosqlite:///./crisis_command.db
GEMINI_API_KEY=           # Optional - demo fallback works without it
AI_CONFIDENCE_THRESHOLD=0.70
DEMO_MODE=true
```

Frontend (`frontend/.env`):
```
VITE_GOOGLE_MAPS_API_KEY= # Google Maps Platform API Key
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/text` | Submit text emergency report |
| POST | `/api/reports/voice` | Submit audio recording report |
| POST | `/api/reports/voice-assistant/chat` | Conversational voice assistant |
| GET | `/api/incidents` | List all incidents |
| GET | `/api/resources` | List all fleet resources |
| POST | `/api/planning/generate` | Generate initial response plan |
| POST | `/api/planning/replan` | Dynamic replanning |
| GET | `/api/planning/current` | Get current plan + diffs |
| GET | `/api/human-review` | Operator review queue |
| POST | `/api/simulation/seed` | Seed demo data |
| POST | `/api/simulation/new-incident` | Add critical incident |
| POST | `/api/simulation/resource-unavailable` | Make resource unavailable |
| POST | `/api/simulation/reset` | Reset simulation |
| WS | `/ws/command` | Real-time WebSocket events |
