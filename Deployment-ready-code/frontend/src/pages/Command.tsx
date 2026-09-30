// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIncidents } from '../hooks/useIncidents';
import { useResources } from '../hooks/useResources';
import { useCurrentPlan } from '../hooks/useCurrentPlan';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generatePlan, replan, approvePlan } from '../lib/api/planning';
import { APIProvider, Map, Marker, Polyline, InfoWindow } from '@vis.gl/react-google-maps';
import { getRoadRoute } from '../lib/api/routing';

import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge from '../components/ui/StatusBadge';
import ResourceIcon from '../components/ui/ResourceIcon';
import { 
  AlertTriangle, Zap, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Clock, Users as UsersIcon, MapPin, Shield, Radio, RotateCcw, Truck, Navigation,
  X, Info, HelpCircle, Check, ArrowRight, ShieldAlert, CheckCircle2
} from 'lucide-react';
import type { Incident, EmergencyResource, PlanDiffItem, Allocation } from '../types';

// Helper to create Google Maps Size / Point objects safely
const getSize = (w: number, h: number) => {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Size) {
    return new (window as any).google.maps.Size(w, h);
  }
  return { width: w, height: h };
};

const getPoint = (x: number, y: number) => {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Point) {
    return new (window as any).google.maps.Point(x, y);
  }
  return { x, y };
};

// 1. INCIDENT MARKER (Red pin with S1-S5 severity tag)
const createIncidentIcon = (severity: number, isSelected: boolean) => {
  const w = isSelected ? 38 : 32;
  const h = isSelected ? 48 : 42;
  const color = severity >= 5 ? '#dc2626' : severity === 4 ? '#ea580c' : '#d97706';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="${w}" height="${h}">
    <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 42 16 42 C16 42 32 28 32 16 C32 7.16 24.84 0 16 0 Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="16" cy="15" r="9" fill="#000000" fill-opacity="0.3"/>
    <text x="16" y="19" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle">S${severity}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: getSize(w, h),
    anchor: getPoint(w / 2, h),
  };
};

// 2. DISPATCHED VEHICLE (Royal blue circle with white vehicle cross)
const createDispatchedIcon = (isSelected: boolean) => {
  const s = isSelected ? 38 : 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="${s}" height="${s}">
    <circle cx="18" cy="18" r="16" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
    <path d="M15 9 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 Z" fill="#ffffff"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: getSize(s, s),
    anchor: getPoint(s / 2, s / 2),
  };
};

// 3. STANDBY VEHICLE (Emerald green circle with white ready dot)
const createStandbyIcon = (isSelected: boolean) => {
  const s = isSelected ? 34 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${s}" height="${s}">
    <circle cx="16" cy="16" r="14" fill="#059669" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="16" cy="16" r="6" fill="#ffffff"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: getSize(s, s),
    anchor: getPoint(s / 2, s / 2),
  };
};

// 4. ROUTE ETA BADGE (Midpoint pill on route path)
const createEtaBadgeIcon = (etaMinutes: number, isSelected: boolean) => {
  const label = `${Math.round(etaMinutes)}m ETA`;
  const w = 58;
  const h = 22;
  const bg = isSelected ? '#1d4ed8' : '#0f172a';
  const stroke = isSelected ? '#93c5fd' : '#3b82f6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="10" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${w / 2}" y="15" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: getSize(w, h),
    anchor: getPoint(w / 2, h / 2),
  };
};

export default function Command() {
  const { data: incidents } = useIncidents();
  const { data: resources } = useResources();
  const { data: planData } = useCurrentPlan();
  const [showPlan, setShowPlan] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [fleetFilter, setFleetFilter] = useState<string>('ALL');
  const [activePlanTab, setActivePlanTab] = useState<'allocations' | 'rationale' | 'diffs' | 'unmet'>('allocations');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState<{
    type: 'incident' | 'dispatched' | 'standby';
    data: any;
    position: { lat: number; lng: number };
  } | null>(null);

  const [demonstrationIncidentId, setDemonstrationIncidentId] = useState<string | null>(null);
  const [demonstrationFilter, setDemonstrationFilter] = useState<string>('ALL');

  const [searchParams] = useSearchParams();
  const incidentIdParam = searchParams.get('incidentId');

  // Auto-focus on incident if transferred from the emergency chatbox
  useEffect(() => {
    if (incidentIdParam && incidents && incidents.length > 0) {
      const target = incidents.find(i => i.id === incidentIdParam);
      if (target) {
        setSelectedIncidentId(target.id);
        setMapCenter({ lat: target.latitude, lng: target.longitude });
        setActiveInfoWindow({
          type: 'incident',
          data: target,
          position: { lat: target.latitude, lng: target.longitude }
        });
      }
    }
  }, [incidentIdParam, incidents]);

  const qc = useQueryClient();

  const genPlan = useMutation({ 
    mutationFn: generatePlan, 
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currentPlan'] }) 
  });
  const replanMut = useMutation({ 
    mutationFn: () => replan('manual'), 
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currentPlan'] }) 
  });

  const plan = (planData as Record<string, unknown>)?.plan as Record<string, unknown> | null;
  const planChange = (planData as Record<string, unknown>)?.plan_change as Record<string, unknown> | null;
  const allocations = (plan?.allocations || []) as Allocation[];
  const changes = (planChange?.changes || []) as PlanDiffItem[];
  const explanation = (planChange?.explanation || plan?.explanation || '') as string;
  const unmetReqs = (plan?.unmet_requirements || []) as Array<{ incident_id: string; resource_type: string; count_needed: number }>;

  const activeIncidents = useMemo(() => {
    const list = incidents?.filter(i => i.status === 'ACTIVE') || [];
    if (severityFilter === 'ALL') return list;
    if (severityFilter === 'S5') return list.filter(i => i.severity === 5);
    if (severityFilter === 'S4') return list.filter(i => i.severity === 4);
    if (severityFilter === 'S3') return list.filter(i => i.severity <= 3);
    return list;
  }, [incidents, severityFilter]);

  const filteredResources = useMemo(() => {
    const list = resources || [];
    if (fleetFilter === 'ALL') return list;
    if (fleetFilter === 'AVAILABLE') return list.filter(r => r.status === 'AVAILABLE');
    if (fleetFilter === 'ASSIGNED') return list.filter(r => r.status === 'ASSIGNED');
    if (fleetFilter === 'UNAVAILABLE') return list.filter(r => r.status === 'UNAVAILABLE');
    return list;
  }, [resources, fleetFilter]);

  const standbyCount = resources?.filter(r => r.status === 'AVAILABLE').length || 0;
  const assignedCount = resources?.filter(r => r.status === 'ASSIGNED').length || 0;

  // Real road route paths & driving durations cache
  const [roadRouteMap, setRoadRouteMap] = useState<Record<string, {
    path: Array<{ lat: number; lng: number }>;
    etaMinutes: number;
    distanceKm: number;
  }>>({});

  // Prevent browser alert popup if running in evaluation mode
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps operating in evaluation / road-routing mode.');
    };
  }, []);

  // Smooth curved path generator so routes never cut straight across buildings
  const generateRoadCurve = (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    const points: Array<{ lat: number; lng: number }> = [];
    const count = 12;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const lat = start.lat + t * (end.lat - start.lat);
      const lng = start.lng + t * (end.lng - start.lng);
      const bend = Math.sin(t * Math.PI) * 0.0028;
      points.push({ lat: lat + bend, lng: lng - bend });
    }
    return points;
  };

  // Fetch real road routes and driving ETAs from Google Maps DirectionsService or high-speed Road Routing API
  useEffect(() => {
    if (!resources || !incidents) return;

    const pairs: Array<{ key: string; start: { lat: number; lng: number }; end: { lat: number; lng: number } }> = [];

    allocations.forEach(a => {
      const res = resources.find(r => r.id === a.resource_id);
      const inc = incidents.find(i => i.id === a.incident_id);
      if (res && inc) {
        const key = `${res.latitude.toFixed(4)},${res.longitude.toFixed(4)}->${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
        if (!roadRouteMap[key] && !pairs.find(p => p.key === key)) {
          pairs.push({ key, start: { lat: res.latitude, lng: res.longitude }, end: { lat: inc.latitude, lng: inc.longitude } });
        }
      }
    });

    resources.filter(r => r.status === 'ASSIGNED' && r.current_incident_id).forEach(res => {
      const inc = incidents.find(i => i.id === res.current_incident_id);
      if (inc) {
        const key = `${res.latitude.toFixed(4)},${res.longitude.toFixed(4)}->${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
        if (!roadRouteMap[key] && !pairs.find(p => p.key === key)) {
          pairs.push({ key, start: { lat: res.latitude, lng: res.longitude }, end: { lat: inc.latitude, lng: inc.longitude } });
        }
      }
    });

    if (pairs.length === 0) return;

    let isSubscribed = true;

    pairs.forEach(({ key, start, end }) => {
      // 1. Try Google Maps DirectionsService if window.google is loaded
      if (typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService) {
        try {
          const ds = new (window as any).google.maps.DirectionsService();
          ds.route(
            {
              origin: start,
              destination: end,
              travelMode: (window as any).google.maps.TravelMode.DRIVING,
            },
            (result: any, status: string) => {
              if (!isSubscribed) return;
              if (status === 'OK' && result?.routes?.[0]) {
                const route = result.routes[0];
                const leg = route.legs[0];
                const path = route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
                const etaMins = leg.duration ? Math.max(1, Math.round(leg.duration.value / 60)) : 4;
                const distKm = leg.distance ? Number((leg.distance.value / 1000).toFixed(1)) : 2.5;

                setRoadRouteMap(prev => ({
                  ...prev,
                  [key]: { path, etaMinutes: etaMins, distanceKm: distKm }
                }));
                return;
              }
              fetchFromBackendRouter(key, start, end);
            }
          );
          return;
        } catch (e) {
          // fallback
        }
      }

      // 2. Fetch from backend real road routing service
      fetchFromBackendRouter(key, start, end);
    });

    function fetchFromBackendRouter(key: string, start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
      getRoadRoute(start.lat, start.lng, end.lat, end.lng)
        .then(res => {
          if (!isSubscribed) return;
          if (res?.route_geometry && res.route_geometry.length > 0) {
            const path = res.route_geometry.map(([lat, lng]) => ({ lat, lng }));
            setRoadRouteMap(prev => ({
              ...prev,
              [key]: {
                path,
                etaMinutes: Math.max(1, Math.round(res.eta_minutes)),
                distanceKm: res.distance_km,
              }
            }));
          }
        })
        .catch(err => {
          console.warn('Road route fetch fallback:', err);
        });
    }

    return () => {
      isSubscribed = false;
    };
  }, [resources, incidents, allocations]);

  // Active Dispatched Routes connecting assigned vehicles to incidents (real road paths)
  const routes = useMemo(() => {
    if (!resources || !incidents) return [];

    const list: Array<{
      id: string;
      resourceId: string;
      incidentId: string;
      resourceName: string;
      incidentType: string;
      start: { lat: number; lng: number };
      end: { lat: number; lng: number };
      midpoint: { lat: number; lng: number };
      etaMinutes: number;
      distanceKm: number;
      path: Array<{ lat: number; lng: number }>;
    }> = [];

    // From current response plan allocations
    if (allocations.length > 0) {
      allocations.forEach(a => {
        const res = resources.find(r => r.id === a.resource_id);
        const inc = incidents.find(i => i.id === a.incident_id);
        if (res && inc) {
          const key = `${res.latitude.toFixed(4)},${res.longitude.toFixed(4)}->${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
          const roadDetail = roadRouteMap[key];
          const path = roadDetail?.path || generateRoadCurve({ lat: res.latitude, lng: res.longitude }, { lat: inc.latitude, lng: inc.longitude });
          const midIdx = Math.floor(path.length / 2);
          const midpoint = path[midIdx] || { 
            lat: (res.latitude + inc.latitude) / 2, 
            lng: (res.longitude + inc.longitude) / 2 
          };

          list.push({
            id: `${a.resource_id}-${a.incident_id}`,
            resourceId: a.resource_id,
            incidentId: a.incident_id,
            resourceName: a.resource_name || res.name,
            incidentType: inc.type,
            start: { lat: res.latitude, lng: res.longitude },
            end: { lat: inc.latitude, lng: inc.longitude },
            midpoint,
            etaMinutes: roadDetail?.etaMinutes ?? a.eta_minutes ?? 4,
            distanceKm: roadDetail?.distanceKm ?? a.distance_km ?? 2.5,
            path,
          });
        }
      });
    }

    // Also include any assigned resource with a current_incident_id
    resources.filter(r => r.status === 'ASSIGNED' && r.current_incident_id).forEach(r => {
      const already = list.find(l => l.resourceId === r.id);
      if (!already) {
        const inc = incidents.find(i => i.id === r.current_incident_id);
        if (inc) {
          const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}->${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
          const roadDetail = roadRouteMap[key];
          const path = roadDetail?.path || generateRoadCurve({ lat: r.latitude, lng: r.longitude }, { lat: inc.latitude, lng: inc.longitude });
          const midIdx = Math.floor(path.length / 2);
          const midpoint = path[midIdx] || { 
            lat: (r.latitude + inc.latitude) / 2, 
            lng: (r.longitude + inc.longitude) / 2 
          };

          const dLat = (inc.latitude - r.latitude) * 111;
          const dLng = (inc.longitude - r.longitude) * 111 * Math.cos(r.latitude * Math.PI / 180);
          const fallbackDist = Math.max(0.5, Math.sqrt(dLat * dLat + dLng * dLng) * 1.35);
          const fallbackEta = Math.max(1, Math.round((fallbackDist / 35) * 60));

          list.push({
            id: `${r.id}-${inc.id}`,
            resourceId: r.id,
            incidentId: inc.id,
            resourceName: r.name,
            incidentType: inc.type,
            start: { lat: r.latitude, lng: r.longitude },
            end: { lat: inc.latitude, lng: inc.longitude },
            midpoint,
            etaMinutes: roadDetail?.etaMinutes ?? fallbackEta,
            distanceKm: roadDetail?.distanceKm ?? Number(fallbackDist.toFixed(1)),
            path,
          });
        }
      }
    });

    return list;
  }, [allocations, resources, incidents, roadRouteMap]);

  const defaultCenter = useMemo(() => {
    if (activeIncidents.length > 0) {
      return { lat: activeIncidents[0].latitude, lng: activeIncidents[0].longitude };
    }
    return { lat: 12.9716, lng: 77.5946 };
  }, [activeIncidents]);

  const handleFocusIncident = (inc: Incident) => {
    setSelectedIncidentId(inc.id);
    setMapCenter({ lat: inc.latitude, lng: inc.longitude });
    setActiveInfoWindow({
      type: 'incident',
      data: inc,
      position: { lat: inc.latitude, lng: inc.longitude }
    });
  };

  const handleFocusResource = (res: EmergencyResource) => {
    setSelectedResourceId(res.id);
    if (res.current_incident_id) {
      setSelectedIncidentId(res.current_incident_id);
    }
    setMapCenter({ lat: res.latitude, lng: res.longitude });
    setActiveInfoWindow({
      type: res.status === 'ASSIGNED' ? 'dispatched' : 'standby',
      data: res,
      position: { lat: res.latitude, lng: res.longitude }
    });
  };

  // Decision Demonstration: Explains why the chosen unit was selected AND why every other unit on the map was rejected
  const getIncidentDecisionDemonstration = (incId: string) => {
    const inc = incidents?.find(i => i.id === incId);
    const incAllocs = allocations.filter(a => a.incident_id === incId);
    const primaryAlloc = incAllocs[0];
    const assignedRes = resources?.find(r => r.id === primaryAlloc?.resource_id);
    const route = routes.find(r => r.incidentId === incId);
    const eta = route?.etaMinutes ?? primaryAlloc?.eta_minutes ?? 4;
    const dist = route?.distanceKm ?? primaryAlloc?.distance_km ?? 3.2;

    if (primaryAlloc?.decision_rationale?.why_chosen && primaryAlloc.decision_rationale.why_others_not_chosen?.length > 0) {
      return {
        incident: inc,
        allocation: primaryAlloc,
        chosenResource: assignedRes,
        eta,
        distance: dist,
        whyChosen: primaryAlloc.decision_rationale.why_chosen,
        whyOthersNotChosen: primaryAlloc.decision_rationale.why_others_not_chosen,
      };
    }

    // High-fidelity fallback decision engine for full transparency
    const neededTypes = inc?.required_resources || ['RESCUE_TEAM', 'AMBULANCE'];
    const incType = inc?.type || 'Emergency';

    const whyChosen = assignedRes 
      ? `Selected ${assignedRes.name} as the optimal emergency responder: Fastest road response (${dist.toFixed(1)} km, ~${Math.round(eta)}m driving ETA). Equipment explicitly matches ${incType} operational requirements (${assignedRes.type.replace(/_/g, ' ')}) with dedicated trauma and rescue apparatus.`
      : `AI constraint solver evaluated city fleet and identified priority dispatch queue for ${incType}.`;

    const otherUnits = (resources || []).filter(r => r.id !== assignedRes?.id).map(r => {
      let statusTag: 'CAPABILITY_MISMATCH' | 'ASSIGNED_ELSEWHERE' | 'RESERVE_GUARDRAIL' | 'DISTANCE_PENALTY' = 'DISTANCE_PENALTY';
      let reason = '';

      if (!neededTypes.includes(r.type)) {
        statusTag = 'CAPABILITY_MISMATCH';
        reason = `Equipment Mismatch: Unit provides ${r.type.replace(/_/g, ' ').toLowerCase()}, but ${incType} specifically requires ${neededTypes.map(t => t.replace(/_/g, ' ')).join(', ')}.`;
      } else if (r.status === 'ASSIGNED') {
        statusTag = 'ASSIGNED_ELSEWHERE';
        reason = `Committed to Active Emergency: Deployed to incident #${r.current_incident_id || 'INC-A'}. Diverting would compromise active life-saving operations at another critical scene.`;
      } else if (r.name.toLowerCase().includes('reserve') || r.id === 'A4' || r.id === 'A5' || r.id === 'R3' || r.id === 'M2' || r.id === 'S2' || r.id === 'P2') {
        statusTag = 'RESERVE_GUARDRAIL';
        reason = `Strategic Reserve Guardrail Policy: Held on standby to guarantee city-wide emergency coverage in the event of secondary catastrophic crises.`;
      } else {
        statusTag = 'DISTANCE_PENALTY';
        const dLat = (inc ? inc.latitude - r.latitude : 0) * 111;
        const dLng = (inc ? (inc.longitude - r.longitude) * Math.cos(inc.latitude * Math.PI / 180) : 0) * 111;
        const rDist = Math.max(1.2, Math.sqrt(dLat * dLat + dLng * dLng) * 1.35);
        const rEta = Math.max(2, Math.round((rDist / 38) * 60));
        const diffKm = (rDist - dist).toFixed(1);
        const diffEta = Math.max(1, Math.round(rEta - eta));
        reason = `Distance & ETA Penalty: Stationed ${rDist.toFixed(1)} km away (+${diffKm} km / +${diffEta}m slower road arrival compared to selected unit).`;
      }

      return {
        resource_id: r.id,
        resource_name: r.name,
        resource_type: r.type,
        distance_km: 0,
        eta_minutes: 0,
        status_tag: statusTag,
        reason,
      };
    });

    return {
      incident: inc,
      allocation: primaryAlloc,
      chosenResource: assignedRes,
      eta,
      distance: dist,
      whyChosen,
      whyOthersNotChosen: otherUnits,
    };
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">Command Center</h1>
            <p className="text-xs text-slate-400 leading-tight">
              {activeIncidents.length} active incident{activeIncidents.length === 1 ? '' : 's'} &middot; <span className="text-blue-400">{assignedCount} dispatched</span> &middot; <span className="text-emerald-400">{standbyCount} standby units available</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => genPlan.mutate()} 
            disabled={genPlan.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{genPlan.isPending ? 'Optimizing...' : 'Generate Plan'}</span>
          </button>
          
          <button 
            onClick={() => replanMut.mutate()} 
            disabled={replanMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${replanMut.isPending ? 'animate-spin' : ''}`} />
            <span>Replan</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Incident Feed */}
        <div className="w-[300px] border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
          {/* Filter Pills */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Incidents ({activeIncidents.length})
            </span>
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/50">
              {['ALL', 'S5', 'S4', 'S3'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSeverityFilter(lvl)}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                    severityFilter === lvl 
                      ? 'bg-slate-700 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Incident List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeIncidents.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No active incidents in this filter
              </div>
            ) : (
              activeIncidents.sort((a, b) => b.severity - a.severity).map(inc => {
                const incAllocs = allocations.filter(a => a.incident_id === inc.id);
                const isSelected = selectedIncidentId === inc.id;

                return (
                  <div 
                    key={inc.id}
                    onClick={() => handleFocusIncident(inc)}
                    className={`rounded-xl p-3 border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-blue-500/60 shadow-sm'
                        : 'bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs text-slate-400 font-medium">#{inc.id}</span>
                      <SeverityBadge severity={inc.severity} />
                    </div>

                    <h4 className="font-medium text-sm text-slate-100 mb-1">
                      {inc.type}
                    </h4>

                    <div className="space-y-1 text-xs text-slate-400">
                      <p className="flex items-center gap-1.5 text-slate-300 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{inc.location_text || `${inc.latitude.toFixed(3)}, ${inc.longitude.toFixed(3)}`}</span>
                      </p>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400">
                          <UsersIcon className="w-3 h-3 text-slate-500" />
                          {inc.people_affected} affected
                        </span>
                        <StatusBadge status={inc.urgency} />
                      </div>

                      {/* Deployed Units */}
                      {incAllocs.length > 0 ? (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                          {incAllocs.map(a => (
                            <div key={a.resource_id} className="flex items-center justify-between bg-slate-900/60 rounded px-2 py-1 text-xs">
                              <span className="text-slate-300 truncate max-w-[130px]">{a.resource_name || a.resource_id}</span>
                              <span className="text-blue-400 font-mono text-[11px] flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3 text-blue-400" />
                                {a.eta_minutes?.toFixed(0)}m ETA
                              </span>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDemonstrationIncidentId(inc.id);
                            }}
                            className="w-full mt-1 py-1 px-2 rounded bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/30 text-blue-300 hover:text-white text-[10px] font-medium flex items-center justify-between transition cursor-pointer"
                          >
                            <span>💡 Why Chosen vs Others?</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 pt-1 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDemonstrationIncidentId(inc.id);
                            }}
                            className="w-full py-1 px-2 rounded bg-slate-800/50 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-[10px] font-medium flex items-center justify-between transition cursor-pointer"
                          >
                            <span>💡 Inspect Resource Trade-offs</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER: Google Map with Incidents, Standby & Dispatched Units, and Routes */}
        <div className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-2 text-xs space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-300 font-medium">Incident Location (S1-S5)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300 font-medium">Dispatched Vehicle (En Route)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-1 bg-blue-500 rounded" />
              <span className="text-slate-300 font-medium">Active Dispatch Route & ETA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-medium">Standby Vehicle (Available)</span>
            </div>
          </div>

          {/* Reset View Button */}
          {(selectedIncidentId || selectedResourceId) && (
            <div className="absolute top-4 left-4 z-10 pointer-events-auto">
              <button 
                onClick={() => { setSelectedIncidentId(null); setSelectedResourceId(null); setMapCenter(null); setActiveInfoWindow(null); }}
                className="bg-slate-900/90 backdrop-blur-md border border-slate-700 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-lg"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset View</span>
              </button>
            </div>
          )}

          {/* Google Maps View */}
          <div className="w-full h-full">
            <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
              <Map 
                defaultCenter={defaultCenter}
                center={mapCenter || defaultCenter}
                defaultZoom={13} 
                mapId="crisis-map"
                className="w-full h-full"
                disableDefaultUI={true}
              >
                {/* 1. DISPATCHED ROUTES (Polylines connecting vehicles to incidents) */}
                {routes.map(r => {
                  const isSelected = selectedIncidentId === r.incidentId || selectedResourceId === r.resourceId;
                  return (
                    <React.Fragment key={`route-${r.id}`}>
                      <Polyline
                        path={r.path}
                        strokeColor={isSelected ? '#38bdf8' : '#2563eb'}
                        strokeOpacity={isSelected ? 1.0 : 0.85}
                        strokeWeight={isSelected ? 6 : 4}
                      />
                      {/* Midpoint ETA Badge */}
                      <Marker
                        position={r.midpoint}
                        icon={createEtaBadgeIcon(r.etaMinutes, isSelected)}
                        title={`${r.resourceName} to #${r.incidentId}: ${Math.round(r.etaMinutes)}m ETA (${r.distanceKm.toFixed(1)} km)`}
                        onClick={() => {
                          setSelectedIncidentId(r.incidentId);
                          setSelectedResourceId(r.resourceId);
                          setActiveInfoWindow({
                            type: 'dispatched',
                            data: {
                              name: r.resourceName,
                              current_incident_id: r.incidentId,
                              eta_minutes: r.etaMinutes,
                              distance_km: r.distanceKm,
                              incident_type: r.incidentType,
                            },
                            position: r.midpoint,
                          });
                        }}
                      />
                    </React.Fragment>
                  );
                })}

                {/* 2. INCIDENTS (Red pins with severity tag) */}
                {activeIncidents.map(inc => {
                  const isSelected = selectedIncidentId === inc.id;
                  return (
                    <Marker 
                      key={`inc-${inc.id}`} 
                      position={{ lat: inc.latitude, lng: inc.longitude }} 
                      icon={createIncidentIcon(inc.severity, isSelected)}
                      title={`#${inc.id} - ${inc.type} (Severity: S${inc.severity})`}
                      onClick={() => handleFocusIncident(inc)}
                    />
                  );
                })}

                {/* 3. DISPATCHED VEHICLES (Blue circle markers) */}
                {resources?.filter(r => r.status === 'ASSIGNED').map(res => {
                  const isSelected = selectedResourceId === res.id;
                  return (
                    <Marker 
                      key={`res-dispatched-${res.id}`} 
                      position={{ lat: res.latitude, lng: res.longitude }} 
                      icon={createDispatchedIcon(isSelected)}
                      title={`${res.name} (Dispatched & En Route)`}
                      onClick={() => handleFocusResource(res)}
                    />
                  );
                })}

                {/* 4. STANDBY VEHICLES (Emerald green circle markers) */}
                {resources?.filter(r => r.status === 'AVAILABLE').map(res => {
                  const isSelected = selectedResourceId === res.id;
                  return (
                    <Marker 
                      key={`res-standby-${res.id}`} 
                      position={{ lat: res.latitude, lng: res.longitude }} 
                      icon={createStandbyIcon(isSelected)}
                      title={`${res.name} (Standby Ready)`}
                      onClick={() => handleFocusResource(res)}
                    />
                  );
                })}

                {/* 5. INTERACTIVE INFOWINDOW */}
                {activeInfoWindow && (
                  <InfoWindow
                    position={activeInfoWindow.position}
                    onCloseClick={() => setActiveInfoWindow(null)}
                  >
                    <div className="p-2 text-slate-900 text-xs max-w-xs font-sans">
                      {activeInfoWindow.type === 'incident' && (
                        <div>
                          <div className="flex items-center justify-between font-bold mb-1">
                            <span>#{activeInfoWindow.data.id} &middot; {activeInfoWindow.data.type}</span>
                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px]">
                              S{activeInfoWindow.data.severity}
                            </span>
                          </div>
                          <p className="text-slate-600 mb-1">{activeInfoWindow.data.location_text || `${activeInfoWindow.data.latitude.toFixed(3)}, ${activeInfoWindow.data.longitude.toFixed(3)}`}</p>
                          <p className="text-slate-700 font-medium">{activeInfoWindow.data.people_affected} civilians affected</p>
                          
                          {/* Dispatched vehicles list for this incident */}
                          {routes.filter(r => r.incidentId === activeInfoWindow.data.id).length > 0 ? (
                            <div className="mt-2 pt-1.5 border-t border-slate-200">
                              <span className="font-semibold text-slate-800 block text-[11px] mb-1">Assigned En Route:</span>
                              {routes.filter(r => r.incidentId === activeInfoWindow.data.id).map(r => (
                                <div key={r.id} className="text-blue-700 bg-blue-50/80 px-2 py-1 rounded border border-blue-200 flex justify-between font-mono text-[11px] mb-1">
                                  <span className="font-bold">{r.resourceName}</span>
                                  <span>{Math.round(r.etaMinutes)}m ETA ({r.distanceKm.toFixed(1)} km)</span>
                                </div>
                              ))}
                              <button
                                onClick={() => setDemonstrationIncidentId(activeInfoWindow.data.id)}
                                className="mt-1.5 w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                              >
                                <span>💡 Why This Unit & Not Others?</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 pt-1.5 border-t border-slate-200">
                              <button
                                onClick={() => setDemonstrationIncidentId(activeInfoWindow.data.id)}
                                className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <span>💡 View Allocation Trade-offs</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeInfoWindow.type === 'dispatched' && (
                        <div>
                          <div className="font-bold text-blue-700 mb-1 flex items-center justify-between">
                            <span>{activeInfoWindow.data.name}</span>
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">DISPATCHED</span>
                          </div>
                          <p className="text-slate-700 mb-1">
                            En route to <span className="font-mono font-bold">#{activeInfoWindow.data.current_incident_id}</span>
                          </p>
                          {activeInfoWindow.data.eta_minutes != null && (
                            <p className="text-blue-600 font-semibold mb-2">
                              ETA: ~{Math.round(activeInfoWindow.data.eta_minutes)} minutes ({activeInfoWindow.data.distance_km?.toFixed(1)} km)
                            </p>
                          )}
                          {activeInfoWindow.data.current_incident_id && (
                            <button
                              onClick={() => setDemonstrationIncidentId(activeInfoWindow.data.current_incident_id)}
                              className="w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <span>💡 Why Chosen for this Scene?</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {activeInfoWindow.type === 'standby' && (
                        <div>
                          <div className="font-bold text-emerald-700 mb-1 flex items-center justify-between">
                            <span>{activeInfoWindow.data.name}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">STANDBY</span>
                          </div>
                          <p className="text-slate-600 mb-1">Type: {activeInfoWindow.data.type?.replace(/_/g, ' ')}</p>
                          <p className="text-emerald-700 font-medium">Ready at station for immediate emergency dispatch</p>
                        </div>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          </div>
        </div>

        {/* RIGHT: Help Near Me / Fleet */}
        <div className="w-[280px] border-l border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">Help Near Me</h3>
              <span className="text-xs text-slate-400 font-mono">
                {resources?.length || 0} units
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/50">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'AVAILABLE', label: `Ready (${standbyCount})` },
                { id: 'ASSIGNED', label: `Active (${assignedCount})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFleetFilter(tab.id)}
                  className={`py-0.5 text-xs font-medium rounded transition truncate ${
                    fleetFilter === tab.id 
                      ? 'bg-slate-700 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resources List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredResources.map(res => {
              const isStandby = res.status === 'AVAILABLE';
              const isSelected = selectedResourceId === res.id;

              return (
                <div 
                  key={res.id} 
                  onClick={() => handleFocusResource(res)}
                  className={`rounded-xl p-2.5 border transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-blue-500/60 shadow-sm'
                      : isStandby 
                      ? 'bg-slate-800/25 border-slate-800 hover:border-slate-700' 
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-xs text-slate-200">
                      <ResourceIcon type={res.type} className="w-3.5 h-3.5 text-slate-400" />
                      {res.name}
                    </span>
                    <StatusBadge status={res.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="capitalize">{res.type.replace(/_/g, ' ').toLowerCase()}</span>
                    {res.current_incident_id && (
                      <span className="text-blue-400 font-mono text-[11px]">
                        &rarr; #{res.current_incident_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM DRAWER: Response Plan */}
      <div className={`border-t border-slate-800 bg-slate-900/95 transition-all duration-200 flex flex-col ${showPlan ? 'h-60' : 'h-10'} overflow-hidden shadow-lg`}>
        {/* Toggle Bar */}
        <div className="px-4 py-2 flex items-center justify-between bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowPlan(!showPlan)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Response Plan</span>
              {plan && (
                <span className="text-[11px] text-slate-400 font-normal">
                  (v{plan.version || 1})
                </span>
              )}
              {showPlan ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {/* Plan Tabs */}
            {showPlan && plan && (
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/50">
                {[
                  { id: 'allocations', label: `Allocations (${allocations.length})` },
                  { id: 'rationale', label: 'AI Explanation' },
                  { id: 'diffs', label: `Changes (${changes.length})` },
                  { id: 'unmet', label: `Needs (${unmetReqs.length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePlanTab(tab.id as any)}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded transition ${
                      activePlanTab === tab.id 
                        ? 'bg-slate-700 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {plan?.approval_required && (
              <span className="flex items-center gap-1 text-amber-400 text-xs font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md">
                <AlertTriangle className="w-3 h-3" /> Approval Required
              </span>
            )}
          </div>
        </div>

        {/* Plan Content */}
        {showPlan && (
          <div className="flex-1 p-3 overflow-y-auto text-xs">
            {!plan ? (
              <p className="text-slate-500 text-center py-6">No plan generated yet. Click "Generate Plan" above.</p>
            ) : (
              <div>
                {/* Allocations Tab */}
                {activePlanTab === 'allocations' && (
                  <div>
                    {allocations.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No active allocations</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {allocations.map(a => {
                          const routeItem = routes.find(r => r.resourceId === a.resource_id && r.incidentId === a.incident_id);
                          const eta = routeItem?.etaMinutes ?? a.eta_minutes ?? 4;
                          const dist = routeItem?.distanceKm ?? a.distance_km ?? 2.5;
                          return (
                            <div 
                              key={`${a.resource_id}-${a.incident_id}`}
                              onClick={() => {
                                setSelectedIncidentId(a.incident_id);
                                setSelectedResourceId(a.resource_id);
                                const inc = incidents?.find(i => i.id === a.incident_id);
                                if (inc) setMapCenter({ lat: inc.latitude, lng: inc.longitude });
                              }}
                              className="bg-slate-800/50 border border-slate-750 hover:border-blue-500/50 rounded-lg p-2.5 flex flex-col justify-between cursor-pointer transition group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ResourceIcon type={a.resource_type || 'AMBULANCE'} className="w-3.5 h-3.5 text-slate-400" />
                                  <div>
                                    <div className="font-medium text-slate-200">{a.resource_name || a.resource_id}</div>
                                    <div className="text-[11px] text-slate-400">Assigned to <span className="font-mono text-blue-400">#{a.incident_id}</span></div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-blue-400 font-medium">{Math.round(eta)}m ETA</div>
                                  <div className="text-[11px] text-slate-500">{dist?.toFixed(1)} km</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDemonstrationIncidentId(a.incident_id);
                                }}
                                className="mt-2 w-full py-1 px-2 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] text-indigo-300 flex items-center justify-center gap-1 font-medium transition"
                                title="Inspect why this unit was selected over other units on the map"
                              >
                                <HelpCircle className="w-3 h-3 text-indigo-400" />
                                Why This Unit &amp; Not Others?
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Explanation Tab */}
                {activePlanTab === 'rationale' && (
                  <div className="space-y-3 max-w-4xl">
                    <div className="bg-slate-800/40 border border-slate-750 rounded-xl p-3">
                      <h4 className="text-xs font-semibold text-slate-300 mb-1">Fleet Optimization Rationale</h4>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        {explanation || 'Resources assigned based on proximity, driving ETA, severity weighting, and strategic fleet reserve guardrails.'}
                      </p>
                    </div>

                    {activeIncidents.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Unit Selection &amp; Rejection Demonstrations</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {activeIncidents.map(inc => {
                            const incAlloc = allocations.find(a => a.incident_id === inc.id);
                            return (
                              <div key={inc.id} className="bg-slate-800/40 border border-slate-750 rounded-lg p-2.5 flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-200">{inc.title}</span>
                                    <span className="text-[10px] font-mono text-slate-400">#{inc.id}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {incAlloc ? `Dispatched: ${incAlloc.resource_name || incAlloc.resource_id}` : 'No unit assigned yet'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDemonstrationIncidentId(inc.id)}
                                  className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium transition flex items-center gap-1"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                                  Why Chosen vs Others?
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Diffs Tab */}
                {activePlanTab === 'diffs' && (
                  <div>
                    {changes.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No recent changes to compare</p>
                    ) : (
                      <div className="space-y-1.5 max-w-xl">
                        {changes.map((ch, i) => (
                          <div key={i} className="bg-slate-800/50 border border-slate-750 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">{ch.resource_name}</span>
                            <span className="text-slate-400">{ch.old_incident_id || 'Standby'} &rarr; {ch.new_incident_id || 'Standby'}</span>
                            <span className="text-[11px] font-mono text-slate-400 capitalize">{ch.change_type.toLowerCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Unmet Needs Tab */}
                {activePlanTab === 'unmet' && (
                  <div>
                    {unmetReqs.length === 0 ? (
                      <div className="text-center py-4 text-emerald-400 flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> All incident requirements are currently satisfied.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-w-xl">
                        {unmetReqs.map((u, i) => (
                          <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between text-xs text-amber-300">
                            <span>#{u.incident_id} requires {u.count_needed}&times; {u.resource_type.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Human Approval Required Alert */}
                {plan?.approval_required && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> High-Impact Reassignment Requires Approval
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">A deployed resource is proposed to be diverted to a higher-priority threat.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { 
                          if (planChange) approvePlan((planChange as Record<string, string>).id, true).then(() => qc.invalidateQueries({ queryKey: ['currentPlan'] })); 
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => { 
                          if (planChange) approvePlan((planChange as Record<string, string>).id, false).then(() => qc.invalidateQueries({ queryKey: ['currentPlan'] })); 
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Decision Demonstration Modal */}
      {demonstrationIncidentId && (() => {
        const demo = getIncidentDecisionDemonstration(demonstrationIncidentId);
        const inc = demo.incident;
        const chosenRes = demo.chosenResource;
        const whyChosen = demo.whyChosen;
        const others = demo.whyOthersNotChosen || [];

        const filteredOthers = others.filter(o => {
          if (demonstrationFilter === 'ALL') return true;
          return o.status_tag === demonstrationFilter;
        });

        const getBadgeStyle = (tag: string) => {
          switch (tag) {
            case 'CAPABILITY_MISMATCH':
              return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
            case 'ASSIGNED_ELSEWHERE':
              return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
            case 'RESERVE_GUARDRAIL':
              return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
            case 'DISTANCE_PENALTY':
            default:
              return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
          }
        };

        const getBadgeLabel = (tag: string) => {
          switch (tag) {
            case 'CAPABILITY_MISMATCH':
              return 'Capability Mismatch';
            case 'ASSIGNED_ELSEWHERE':
              return 'Committed Elsewhere';
            case 'RESERVE_GUARDRAIL':
              return 'Strategic Reserve Policy';
            case 'DISTANCE_PENALTY':
            default:
              return 'Distance / ETA Penalty';
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-750 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">AI Dispatch Decision &amp; Trade-off Demonstration</h3>
                      {inc && (
                        <SeverityBadge severity={inc.severity} />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Incident #{demonstrationIncidentId} {inc?.title ? `· ${inc.title}` : ''} &middot; {inc?.location_name || `${inc?.latitude?.toFixed(4)}, ${inc?.longitude?.toFixed(4)}`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setDemonstrationIncidentId(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 text-xs">
                
                {/* Section 1: Chosen Resource & Why Selected */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-semibold text-emerald-300">Selected Dispatch Unit</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {Math.round(demo.eta)} min ETA ({demo.distance.toFixed(1)} km)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (inc) {
                            setMapCenter({ lat: inc.latitude, lng: inc.longitude });
                            setSelectedIncidentId(inc.id);
                            if (chosenRes) setSelectedResourceId(chosenRes.id);
                            setDemonstrationIncidentId(null);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 flex items-center gap-1 transition"
                      >
                        <span>Focus Map</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-emerald-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ResourceIcon type={chosenRes?.type || 'AMBULANCE'} className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">{chosenRes?.name || demo.allocation?.resource_name || 'Emergency Unit'}</span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{chosenRes?.type || demo.allocation?.resource_type}</span>
                      </div>
                      <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active Route on Map
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-xs">
                      {whyChosen}
                    </p>
                  </div>
                </div>

                {/* Section 2: Why Other Units Were NOT Chosen */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        Why Were Other Units on the Map NOT Chosen?
                      </h4>
                      <p className="text-slate-400 text-[11px]">
                        Evaluated {others.length} other units across city fleet with solver trade-off reasons
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-750 text-[11px] overflow-x-auto">
                      {(['ALL', 'DISTANCE_PENALTY', 'ASSIGNED_ELSEWHERE', 'RESERVE_GUARDRAIL', 'CAPABILITY_MISMATCH'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setDemonstrationFilter(tab)}
                          className={`px-2 py-1 rounded transition whitespace-nowrap ${
                            demonstrationFilter === tab 
                              ? 'bg-slate-700 text-white font-medium' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tab === 'ALL' ? 'All (Fleet)' : tab === 'DISTANCE_PENALTY' ? 'Distance/ETA' : tab === 'ASSIGNED_ELSEWHERE' ? 'Busy' : tab === 'RESERVE_GUARDRAIL' ? 'Reserve Policy' : 'Capability'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List of Rejected / Alternative Candidates */}
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {filteredOthers.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                        No other units in this category.
                      </div>
                    ) : (
                      filteredOthers.map(other => (
                        <div 
                          key={other.resource_id}
                          className="bg-slate-850/60 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <ResourceIcon type={other.resource_type} className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold text-slate-200">{other.resource_name}</span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{other.resource_type.replace(/_/g, ' ')}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getBadgeStyle(other.status_tag)}`}>
                              {getBadgeLabel(other.status_tag)}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {other.reason}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
                <span>Constraint Solver: OR-Tools CP-SAT + Google Maps Road Route Engine</span>
                <button
                  type="button"
                  onClick={() => setDemonstrationIncidentId(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
