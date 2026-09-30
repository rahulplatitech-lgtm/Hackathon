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
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Leaflet |
| Backend | Python 3.12+, FastAPI, Pydantic, SQLAlchemy |
| Optimization | Google OR-Tools (CP-SAT solver) |
| ML | XGBoost, Random Forest, Federated Learning (FedAvg/SGD) |
| AI | Gemini API (optional) with demo fallback |
| Database | SQLite (easily swappable to PostgreSQL) |
| Real-time | WebSocket |
| Maps | Leaflet + OpenStreetMap (CartoDB dark tiles) |

### Pages

- `/` — Landing page
- `/report` — Emergency reporting (SOS button, text, voice)
- `/operator` — Human operator review dashboard
- `/command` — **Main Command Center** (incidents, map, resources, plan)
- `/simulation` — Hackathon demo controller

### Demo Procedure

1. Open `/simulation` — click **Seed Data** (loads 3 incidents + 8 resources)
2. Click **Generate Plan** (OR-Tools allocates resources)
3. Open `/command` — see incidents, map markers, resources, response plan
4. Back to `/simulation` — click **Add Critical Incident** (Severity 5)
5. Click **A2 Unavailable** (ambulance breakdown)
6. Click **Dynamic Replan** — system reassesses and generates new plan
7. Check `/command` — see plan diff (old vs new), color-coded changes, explanation

### Environment Variables

Backend (`.env`):
```
DATABASE_URL=sqlite+aiosqlite:///./crisis_command.db
GEMINI_API_KEY=           # Optional - demo mode works without it
AI_CONFIDENCE_THRESHOLD=0.70
DEMO_MODE=true
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/text` | Submit text emergency |
| POST | `/api/reports/voice` | Submit voice emergency |
| GET | `/api/incidents` | List all incidents |
| GET | `/api/resources` | List all resources |
| POST | `/api/planning/generate` | Generate response plan |
| POST | `/api/planning/replan` | Dynamic replanning |
| GET | `/api/planning/current` | Get current plan + diff |
| GET | `/api/human-review` | Operator review queue |
| POST | `/api/simulation/seed` | Seed demo data |
| POST | `/api/simulation/new-incident` | Add critical incident |
| POST | `/api/simulation/resource-unavailable` | Make resource unavailable |
| POST | `/api/simulation/reset` | Reset simulation |
| WS | `/ws/command` | Real-time events |
