"""Agent 10 - Dynamic Replanning Agent.
Detects changes and produces updated plans with diffs."""
from typing import List, Dict, Any, Optional
from app.agents.priority_triage import triage_agent
from app.optimization.allocator import ResourceAllocator
from app.agents.command_planning import command_agent
import uuid

class DynamicReplanningAgent:
    def __init__(self):
        self.allocator = ResourceAllocator()

    async def replan(self, incidents: List[Dict], resources: List[Dict],
                     old_plan: Optional[Dict], trigger: str) -> Dict[str, Any]:
        """Rerun full planning pipeline and generate diff."""
        # Step 1: Recalculate priorities
        available_count = sum(1 for r in resources if r.get("status") == "AVAILABLE")
        priorities = triage_agent.calculate_priorities(incidents, available_count)

        # Apply priority scores to incidents
        priority_map = {p["incident_id"]: p["priority_score"] for p in priorities}
        for inc in incidents:
            inc["priority_score"] = priority_map.get(inc["id"], 0)

        # Step 2: Rerun optimizer
        result = self.allocator.allocate(incidents, resources)
        new_allocs = result["allocations"]
        unmet = result["unmet"]

        # Step 3: Generate diff
        old_allocs = old_plan.get("allocations", []) if old_plan else []
        changes = self._compute_diff(old_allocs, new_allocs, resources)

        # Step 4: Check if approval required
        approval = command_agent.determine_approval_required(old_allocs, new_allocs, incidents)

        # Step 5: Generate explanation
        explanation = await command_agent.generate_reallocation_explanation(
            old_allocs, new_allocs, trigger, changes
        )

        # Step 6: Build new plan
        new_plan = {
            "id": str(uuid.uuid4())[:8],
            "version": (old_plan.get("version", 0) + 1) if old_plan else 1,
            "status": "ACTIVE",
            "allocations": new_allocs,
            "unmet_requirements": unmet,
            "warnings": [],
            "approval_required": approval,
            "explanation": explanation,
            "objective_score": result["score"],
        }

        plan_change = {
            "id": str(uuid.uuid4())[:8],
            "old_plan_id": old_plan.get("id") if old_plan else None,
            "new_plan_id": new_plan["id"],
            "trigger_event": trigger,
            "changes": changes,
            "explanation": explanation,
            "approval_required": approval,
            "approved": None,
        }

        return {
            "new_plan": new_plan,
            "plan_change": plan_change,
            "priorities": priorities,
        }

    def _compute_diff(self, old_allocs: List[Dict], new_allocs: List[Dict],
                      resources: List[Dict]) -> List[Dict]:
        """Compare old and new allocations to produce diff."""
        resource_names = {r["id"]: r.get("name", r["id"]) for r in resources}
        unavailable_ids = {r["id"] for r in resources if r.get("status") == "UNAVAILABLE"}

        old_map = {a["resource_id"]: a.get("incident_id") for a in old_allocs}
        new_map = {a["resource_id"]: a.get("incident_id") for a in new_allocs}

        all_resource_ids = set(old_map.keys()) | set(new_map.keys()) | unavailable_ids
        changes = []

        for rid in sorted(all_resource_ids):
            old_inc = old_map.get(rid)
            new_inc = new_map.get(rid)
            name = resource_names.get(rid, rid)

            if rid in unavailable_ids:
                changes.append({
                    "resource_id": rid, "resource_name": name,
                    "old_incident_id": old_inc, "new_incident_id": None,
                    "change_type": "UNAVAILABLE",
                })
            elif old_inc is None and new_inc is not None:
                changes.append({
                    "resource_id": rid, "resource_name": name,
                    "old_incident_id": None, "new_incident_id": new_inc,
                    "change_type": "NEW_ASSIGNMENT",
                })
            elif old_inc is not None and new_inc is None:
                changes.append({
                    "resource_id": rid, "resource_name": name,
                    "old_incident_id": old_inc, "new_incident_id": None,
                    "change_type": "UNASSIGNED",
                })
            elif old_inc != new_inc:
                changes.append({
                    "resource_id": rid, "resource_name": name,
                    "old_incident_id": old_inc, "new_incident_id": new_inc,
                    "change_type": "REASSIGNED",
                })
            else:
                changes.append({
                    "resource_id": rid, "resource_name": name,
                    "old_incident_id": old_inc, "new_incident_id": new_inc,
                    "change_type": "UNCHANGED",
                })

        return changes

replanning_agent = DynamicReplanningAgent()
