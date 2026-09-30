"""Agent 8 - Command/Planning Agent.
Coordinates all agent outputs into a unified response plan."""
from typing import List, Dict, Any
from app.ai.gemini import get_ai_provider
import uuid

class CommandPlanningAgent:
    def __init__(self):
        self.ai = get_ai_provider()

    async def generate_plan(self, incidents: List[Dict], allocations: List[Dict],
                            unmet: List[Dict], priorities: List[Dict]) -> Dict[str, Any]:
        """Generate a complete response plan."""
        warnings = []
        approval_required = False

        # Check for critical unmet needs
        for u in unmet:
            if any(i.get("severity", 0) >= 4 for i in incidents if i["id"] == u["incident_id"]):
                warnings.append(f"Critical incident {u['incident_id']} missing {u['resource_type']}")
                approval_required = True

        # Check if any critical incident has no resources
        allocated_incidents = {a["incident_id"] for a in allocations}
        for inc in incidents:
            if inc.get("severity", 0) >= 4 and inc["id"] not in allocated_incidents:
                warnings.append(f"Critical incident {inc['id']} has NO resources assigned")
                approval_required = True

        explanation = await self.ai.generate_explanation({
            "trigger_event": "Plan generation",
            "incidents": len(incidents),
            "allocations": len(allocations),
            "unmet": len(unmet),
            "changes": [],
        })

        return {
            "id": str(uuid.uuid4())[:8],
            "version": 1,
            "status": "ACTIVE",
            "allocations": allocations,
            "unmet_requirements": unmet,
            "warnings": warnings,
            "approval_required": approval_required,
            "explanation": explanation,
            "objective_score": sum(a.get("eta_minutes", 0) for a in allocations),
        }

    async def generate_reallocation_explanation(self, old_allocs: List[Dict],
                                                  new_allocs: List[Dict],
                                                  trigger: str,
                                                  changes: List[Dict]) -> str:
        """Generate human-readable explanation for plan changes."""
        context = {
            "trigger_event": trigger,
            "changes": changes,
            "old_count": len(old_allocs),
            "new_count": len(new_allocs),
        }
        return await self.ai.generate_explanation(context)

    def determine_approval_required(self, old_allocs: List[Dict], new_allocs: List[Dict],
                                     incidents: List[Dict]) -> bool:
        """Deterministic rules for when human approval is required."""
        old_critical = set()
        new_critical = set()

        critical_incidents = {i["id"] for i in incidents if i.get("severity", 0) >= 4}

        for a in old_allocs:
            if a["incident_id"] in critical_incidents:
                old_critical.add(a["resource_id"])

        for a in new_allocs:
            if a["incident_id"] in critical_incidents:
                new_critical.add(a["resource_id"])

        # Approval if removing from critical incident
        removed_from_critical = old_critical - new_critical
        if removed_from_critical:
            return True

        # Approval if a critical incident loses all resources
        old_crit_incidents = {a["incident_id"] for a in old_allocs if a["incident_id"] in critical_incidents}
        new_crit_incidents = {a["incident_id"] for a in new_allocs if a["incident_id"] in critical_incidents}
        if old_crit_incidents - new_crit_incidents:
            return True

        return False

command_agent = CommandPlanningAgent()
