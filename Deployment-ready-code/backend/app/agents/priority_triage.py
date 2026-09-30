"""Agent 5 - Priority/Triage Agent.
Deterministic priority scoring with configurable weights."""
from typing import List, Dict, Any
from datetime import datetime, timezone
from app.config import settings

class PriorityTriageAgent:
    def __init__(self):
        self.weights = {
            "severity": settings.SEVERITY_WEIGHT,
            "urgency": settings.URGENCY_WEIGHT,
            "victims": settings.VICTIM_WEIGHT,
            "waiting_time": settings.WAITING_TIME_WEIGHT,
            "scarcity": settings.SCARCITY_WEIGHT,
        }

    def calculate_priorities(self, incidents: List[Dict[str, Any]],
                            available_resource_count: int = 8) -> List[Dict[str, Any]]:
        """Calculate priority scores for all incidents. Returns sorted list."""
        urgency_map = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2}
        now = datetime.now(timezone.utc)
        scored = []

        for inc in incidents:
            if inc.get("status") not in ("ACTIVE", "CONFIRMED"):
                continue

            severity_score = (inc.get("severity", 1) / 5.0) * self.weights["severity"]

            urgency_val = urgency_map.get(inc.get("urgency", "MEDIUM"), 3)
            urgency_score = (urgency_val / 5.0) * self.weights["urgency"]

            people = min(inc.get("people_affected", 1), 100)
            victim_score = (people / 100.0) * self.weights["victims"]

            # Waiting time factor
            created = inc.get("created_at")
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except Exception:
                    created = now
            elif created is None:
                created = now
            # Ensure both are timezone-aware or both naive for comparison
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            wait_minutes = max((now - created).total_seconds() / 60.0, 0)
            waiting_score = min(wait_minutes / 60.0, 1.0) * self.weights["waiting_time"]

            # Resource scarcity
            needed = len(inc.get("required_resources", []))
            scarcity = needed / max(available_resource_count, 1)
            scarcity_score = min(scarcity, 1.0) * self.weights["scarcity"]

            total = severity_score + urgency_score + victim_score + waiting_score + scarcity_score
            total = round(total * 100, 2)  # Scale to 0-100

            scored.append({
                "incident_id": inc["id"],
                "priority_score": total,
                "reasoning": {
                    "severity_contribution": round(severity_score * 100, 2),
                    "urgency_contribution": round(urgency_score * 100, 2),
                    "victim_contribution": round(victim_score * 100, 2),
                    "waiting_time_contribution": round(waiting_score * 100, 2),
                    "scarcity_contribution": round(scarcity_score * 100, 2),
                },
            })

        # Sort by priority score descending
        scored.sort(key=lambda x: x["priority_score"], reverse=True)
        for rank, item in enumerate(scored, 1):
            item["priority_rank"] = rank

        return scored

triage_agent = PriorityTriageAgent()
