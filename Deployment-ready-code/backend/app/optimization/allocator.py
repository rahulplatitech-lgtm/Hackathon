"""OR-Tools CP-SAT based resource allocation optimizer.
Resources are NEVER allocated by LLM. This is deterministic, intelligent optimization.
Enforces:
1. Severity-based resource caps (prevent over-helping lower-severity incidents).
2. Strategic fleet reserve buffers (always maintain backup capacity for unexpected crises).
3. Priority-weighted preemption (high severity incidents get units first).
"""
from ortools.sat.python import cp_model
from typing import List, Dict, Any, Tuple
import math
import logging

logger = logging.getLogger(__name__)

class ResourceAllocator:
    RESOURCE_TYPE_COMPATIBILITY = {
        "AMBULANCE": ["AMBULANCE"],
        "MEDICAL_UNIT": ["MEDICAL_UNIT"],
        "RESCUE_TEAM": ["RESCUE_TEAM"],
        "POLICE_UNIT": ["POLICE_UNIT"],
        "SHELTER": ["SHELTER"],
    }

    # Policy: Maximum units an incident can receive based on its severity level
    # Prevents hoarding/over-allocation to minor/medium incidents
    SEVERITY_MAX_UNITS = {
        5: 2,  # Critical emergency: up to 2 essential units
        4: 2,  # High severity: up to 2 units
        3: 1,  # Medium severity: at most 1 unit (e.g. Shelter or Rescue, no ambulance hoarding)
        2: 1,  # Low severity: at most 1 unit
        1: 1,  # Minor: at most 1 unit
    }

    def allocate(self, incidents: List[Dict], resources: List[Dict]) -> Dict[str, Any]:
        """Run OR-Tools optimization to allocate resources to incidents."""
        # Candidate resources are all non-unavailable units
        candidates = [r for r in resources if r.get("status") != "UNAVAILABLE"]
        active = [i for i in incidents if i.get("status") in ("ACTIVE", "CONFIRMED")]

        if not active or not candidates:
            return {"allocations": [], "unmet": [], "score": 0.0}

        model = cp_model.CpModel()
        n_inc = len(active)
        n_res = len(candidates)

        # Decision variables: assign[i][j] = 1 if resource j assigned to incident i
        assign = {}
        for i in range(n_inc):
            for j in range(n_res):
                assign[(i, j)] = model.NewBoolVar(f"assign_{i}_{j}")

        # Constraint 1: Each resource assigned to at most one incident
        for j in range(n_res):
            model.AddAtMostOne(assign[(i, j)] for i in range(n_inc))

        # Constraint 2: Type compatibility and requirement count per incident
        for i in range(n_inc):
            inc = active[i]
            needed_types = inc.get("required_resources", [])
            sev = int(inc.get("severity", 3))

            # Count of each required resource type
            type_counts = {}
            for t in needed_types:
                type_counts[t] = type_counts.get(t, 0) + 1

            for j in range(n_res):
                res_type = candidates[j].get("type", "")
                if res_type not in needed_types:
                    model.Add(assign[(i, j)] == 0)

            # Cap each resource type to what is actually requested
            for rtype, max_count in type_counts.items():
                res_of_type = [j for j in range(n_res) if candidates[j].get("type", "") == rtype]
                if res_of_type:
                    model.Add(sum(assign[(i, j)] for j in res_of_type) <= max_count)

            # Constraint 3: Strict Severity-based resource cap
            # Do NOT over-allocate to lower severity incidents!
            max_allowed_units = self.SEVERITY_MAX_UNITS.get(sev, 1)
            # Exception: catastrophic disaster with > 10 victims can get up to 3 units
            if sev >= 5 and int(inc.get("people_affected", 1)) >= 10:
                max_allowed_units = 3

            model.Add(sum(assign[(i, j)] for j in range(n_res)) <= max_allowed_units)

        # Constraint 4: Fleet Reserve Buffer (Keep Backup Capacity)
        # Always maintain at least 1-2 units in reserve for critical types if fleet permits
        has_critical_incidents = any(int(inc.get("severity", 0)) >= 5 for inc in active)
        
        for rtype in ["AMBULANCE", "RESCUE_TEAM", "POLICE_UNIT"]:
            res_indices = [j for j in range(n_res) if candidates[j].get("type", "") == rtype]
            count_res = len(res_indices)
            if count_res >= 2:
                # Keep at least 1 unit on reserve standby, or 2 if fleet >= 4
                reserve_min = 2 if count_res >= 4 else 1
                # If there are multiple critical incidents, allow dipping to 1 reserve
                if has_critical_incidents:
                    reserve_min = 1
                max_deployable = max(1, count_res - reserve_min)
                model.Add(sum(assign[(i, j)] for i in range(n_inc) for j in res_indices) <= max_deployable)

        # Objective: Maximize priority coverage (quadratic weight), minimize travel distance
        DISTANCE_SCALE = 1000
        objective_terms = []
        distances = {}

        for i in range(n_inc):
            inc = active[i]
            sev = int(inc.get("severity", 3))
            priority = float(inc.get("priority_score", 50.0))

            # Quadratic priority weight: Severity 5 gets exponentially higher priority than S3
            # S5 (priority 90-100) -> 8100-10000 weight
            # S4 (priority 70-80)  -> 4900-6400 weight
            # S3 (priority 30-40)  -> 900-1600 weight
            priority_weight = int((priority ** 2) * 5)

            for j in range(n_res):
                res = candidates[j]
                dist = self._haversine(
                    inc.get("latitude", 0), inc.get("longitude", 0),
                    res.get("latitude", 0), res.get("longitude", 0),
                )
                distances[(i, j)] = dist
                dist_cost = int(dist * DISTANCE_SCALE)

                # Net benefit for dispatching this resource
                benefit = priority_weight - dist_cost
                objective_terms.append(assign[(i, j)] * benefit)

        if objective_terms:
            model.Maximize(sum(objective_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 5.0
        status = solver.Solve(model)

        allocations = []
        assigned_resources = set()

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for i in range(n_inc):
                for j in range(n_res):
                    if solver.BooleanValue(assign[(i, j)]):
                        dist = distances[(i, j)]
                        eta = max(dist / 40.0 * 60, 1.0)  # 40 km/h average speed
                        allocations.append({
                            "incident_id": active[i]["id"],
                            "resource_id": candidates[j]["id"],
                            "resource_name": candidates[j].get("name", ""),
                            "resource_type": candidates[j].get("type", ""),
                            "distance_km": round(dist, 2),
                            "eta_minutes": round(eta, 1),
                            "status": "ASSIGNED",
                        })
                        assigned_resources.add(candidates[j]["id"])

        # Determine unmet requirements
        unmet = []
        for inc in active:
            needed = inc.get("required_resources", [])
            assigned_types = [a["resource_type"] for a in allocations if a["incident_id"] == inc["id"]]
            for rtype in set(needed):
                needed_count = needed.count(rtype)
                assigned_count = assigned_types.count(rtype)
                if assigned_count < needed_count:
                    unmet.append({
                        "incident_id": inc["id"],
                        "incident_type": inc.get("type", ""),
                        "resource_type": rtype,
                        "count_needed": needed_count - assigned_count,
                    })

        score = solver.ObjectiveValue() if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else 0
        logger.info(f"Allocation completed: {len(allocations)} assigned out of {n_res} candidates. {len(unmet)} unmet.")

        return {
            "allocations": allocations,
            "unmet": unmet,
            "score": float(score),
        }

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
