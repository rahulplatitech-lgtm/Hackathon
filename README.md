# Hackathon Projects Repository

This repository contains hackathon project implementations, structured by deployment readiness.

## Repository Structure

```
Hackathon/
├── Deployment-ready-code/    # Crisis Command AI (Production-ready full-stack platform)
│   ├── backend/              # FastAPI Python multi-agent backend & AI voice engine
│   ├── frontend/             # React 18 + Vite + TypeScript emergency command dashboard
│   ├── README.md             # Detailed architecture & setup guide for Crisis Command AI
│   └── test_class.py         # Production test script
│
└── Testing-code/             # Experimental sandbox & prototyping
    └── proto_Rahul.py        # Prototype testing scripts
```

---

## 🚨 Featured Project: Crisis Command AI

Located in [`Deployment-ready-code/`](./Deployment-ready-code):

**Crisis Command AI** is an autonomous multi-agent emergency response and dynamic resource coordination system featuring:
- **Interactive Voice Dispatcher**: Natural, situation-aware emergency voice assistant powered by Gemini 1.5 Flash and a multi-turn crisis dialogue engine.
- **Multi-Agent Coordination Pipeline**: Emergency Intake, Distress Classification, Human Escalation, Priority Triage, and OR-Tools Resource Allocation.
- **Interactive Tactical Google Map**: Live tracking of S1–S5 incidents, dispatched response units, standby units, dynamic routing polylines, and real-time ETAs.
- **Operator Command Console**: Real-time review queue, live simulation controls, and dispatch monitoring.

### Quick Start

```bash
# 1. Start Backend (Terminal 1)
cd Deployment-ready-code/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 2. Start Frontend (Terminal 2)
cd Deployment-ready-code/frontend
npm install
npm run dev
```

For complete system architecture, API schemas, and deployment instructions, refer to [`Deployment-ready-code/README.md`](./Deployment-ready-code/README.md).
