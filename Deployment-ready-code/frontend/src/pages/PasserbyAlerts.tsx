import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Bell, Radio, MapPin, Users, ShieldAlert, Heart, CheckCircle2, 
  Smartphone, Send, AlertTriangle, Flame, Activity, PhoneCall, RefreshCw, Eye
} from 'lucide-react';
import { APIProvider, Map, Marker, Circle, InfoWindow } from '@vis.gl/react-google-maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNearbyPasserby, broadcastPasserbyAlert } from '../lib/api/passerby';
import { useIncidents } from '../hooks/useIncidents';
import type { PasserbyCitizen, PasserbyBroadcast } from '../types';

export default function PasserbyAlerts() {
  const qc = useQueryClient();
  const { data: incidents = [] } = useIncidents();
  
  // Center location (Connaught Place / Bangalore active scene)
  const [centerLat, setCenterLat] = useState<number>(12.9716);
  const [centerLng, setCenterLng] = useState<number>(77.5946);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('INC-A');
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [broadcastLog, setBroadcastLog] = useState<PasserbyBroadcast | null>(null);
  const [simulatedMobileAlert, setSimulatedMobileAlert] = useState<boolean>(false);
  const [citizenResponses, setCitizenResponses] = useState<Record<string, string>>({});
  const [selectedCitizen, setSelectedCitizen] = useState<PasserbyCitizen | null>(null);

  // Sync center when an incident is picked
  useEffect(() => {
    if (incidents.length > 0) {
      const inc = incidents.find(i => i.id === selectedIncidentId) || incidents[0];
      setCenterLat(inc.latitude);
      setCenterLng(inc.longitude);
    }
  }, [selectedIncidentId, incidents]);

  // Query nearby passerby
  const { data: passerby = [], refetch } = useQuery({
    queryKey: ['passerby', centerLat, centerLng, radiusMeters],
    queryFn: () => getNearbyPasserby(centerLat, centerLng, radiusMeters),
  });

  // Broadcast mutation
  const broadcastMut = useMutation({
    mutationFn: (payload: { incident_id: string; latitude: number; longitude: number; radius_meters: number; emergency_type: string; severity: number }) => 
      broadcastPasserbyAlert(payload),
    onSuccess: (data) => {
      setBroadcastLog(data);
      setSimulatedMobileAlert(true);
      qc.invalidateQueries({ queryKey: ['passerby'] });
    }
  });

  const insideRadiusCount = useMemo(() => {
    return passerby.filter(p => p.distance_meters <= radiusMeters).length;
  }, [passerby, radiusMeters]);

  const firstAidersCount = useMemo(() => {
    return passerby.filter(p => p.distance_meters <= radiusMeters && p.has_first_aid_kit).length;
  }, [passerby, radiusMeters]);

  const handleTriggerBroadcast = () => {
    const inc = incidents.find(i => i.id === selectedIncidentId);
    broadcastMut.mutate({
      incident_id: selectedIncidentId,
      latitude: centerLat,
      longitude: centerLng,
      radius_meters: radiusMeters,
      emergency_type: inc?.type || 'Structure Fire',
      severity: inc?.severity || 4,
    });
  };

  const handleCitizenResponse = (responseType: 'EN_ROUTE' | 'CLEARING') => {
    const firstCitizen = passerby[0]?.id || 'CIT-01';
    setCitizenResponses(prev => ({
      ...prev,
      [firstCitizen]: responseType === 'EN_ROUTE' ? 'Acknowledged: En Route with First Aid Kit' : 'Safe: Moving to Clear Roadway'
    }));
    setTimeout(() => {
      setSimulatedMobileAlert(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-800 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to overview</span>
        </Link>

        {/* Page Title & Concept Badge */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Radio className="w-3.5 h-3.5 animate-pulse text-rose-600" />
              <span>100-Meter Geofenced Passerby Alert System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Passerby Emergency Notification Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              When an emergency occurs, CrisisSync AI automatically detects all citizens and passersby within a 
              <strong> 100-meter radius</strong>, sending instant mobile push alerts to mobilize volunteer first-aid, 
              provide CPR before ambulances arrive, and clear vehicle access corridors.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleTriggerBroadcast}
              disabled={broadcastMut.isPending}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              <span>{broadcastMut.isPending ? 'Broadcasting...' : 'Simulate 100m Alert Broadcast'}</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Map & Geofence Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Map Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span className="font-bold text-xs text-slate-800">
                    Live Geofence Radar ({radiusMeters}m Broadcast Zone)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {insideRadiusCount} Citizens Within 100m
                  </span>
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                    {firstAidersCount} First-Aiders Ready
                  </span>
                </div>
              </div>

              {/* Map Canvas */}
              <div className="relative h-[380px] w-full bg-slate-100">
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                  <Map
                    center={{ lat: centerLat, lng: centerLng }}
                    zoom={17}
                    mapId="DEMO_MAP_ID"
                    disableDefaultUI={true}
                    zoomControl={true}
                    className="w-full h-full"
                  >
                    {/* Center Emergency Incident Marker */}
                    <Marker
                      position={{ lat: centerLat, lng: centerLng }}
                      title="Emergency Incident Center"
                    />

                    {/* 100m Geofence Perimeter Circle */}
                    <Circle
                      center={{ lat: centerLat, lng: centerLng }}
                      radius={radiusMeters}
                      fillColor="#f43f5e"
                      fillOpacity={0.12}
                      strokeColor="#e11d48"
                      strokeOpacity={0.8}
                      strokeWeight={2}
                    />

                    {/* Passerby Markers */}
                    {passerby.map(c => {
                      const isInside = c.distance_meters <= radiusMeters;
                      const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26">
                        <circle cx="14" cy="14" r="12" fill="${isInside ? '#10b981' : '#94a3b8'}" stroke="#ffffff" stroke-width="2.5"/>
                        <circle cx="14" cy="14" r="4" fill="#ffffff"/>
                      </svg>`;
                      const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconSvg)}`;

                      return (
                        <Marker
                          key={c.id}
                          position={{ lat: c.latitude, lng: c.longitude }}
                          title={`${c.name} (${c.distance_meters}m away)`}
                          icon={{ url: iconUrl }}
                          onClick={() => setSelectedCitizen(c)}
                        />
                      );
                    })}

                    {selectedCitizen && (
                      <InfoWindow
                        position={{ lat: selectedCitizen.latitude, lng: selectedCitizen.longitude }}
                        onCloseClick={() => setSelectedCitizen(null)}
                      >
                        <div className="p-2 text-xs text-slate-800 max-w-xs">
                          <div className="font-bold text-sm text-slate-900">{selectedCitizen.name}</div>
                          <div className="text-slate-500 text-[11px] mb-1">{selectedCitizen.phone_masked}</div>
                          <div className="text-rose-600 font-bold mb-1">
                            {selectedCitizen.distance_meters}m away {selectedCitizen.distance_meters <= radiusMeters ? '(Inside 100m)' : '(Outside)'}
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px]">
                            <strong>Skill:</strong> {selectedCitizen.skill}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>

                {/* Floating Geofence Pill */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>100m Active Broadcast Radius</span>
                </div>
              </div>

              {/* Slider & Filter Controls */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">Select Emergency Scene:</span>
                  <select
                    value={selectedIncidentId}
                    onChange={(e) => setSelectedIncidentId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none"
                  >
                    {incidents.map(inc => (
                      <option key={inc.id} value={inc.id}>
                        #{inc.id} - {inc.type} (S{inc.severity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Broadcast Radius:</span>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    step="25"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-28 accent-rose-600"
                  />
                  <span className="text-xs font-bold text-rose-600">{radiusMeters}m</span>
                </div>
              </div>
            </div>

            {/* Passerby Citizens List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span>Detected Passerby Roster ({passerby.length})</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="pb-2">Citizen Name</th>
                      <th className="pb-2">Distance</th>
                      <th className="pb-2">Geofence Status</th>
                      <th className="pb-2">Skills & Capability</th>
                      <th className="pb-2">Live Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passerby.map(c => {
                      const isInside = c.distance_meters <= radiusMeters;
                      const response = citizenResponses[c.id];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-2.5 font-semibold text-slate-900">
                            {c.name}
                            <span className="block text-[10px] text-slate-400 font-normal">{c.phone_masked}</span>
                          </td>
                          <td className="py-2.5">
                            <span className={`font-bold ${isInside ? 'text-rose-600' : 'text-slate-400'}`}>
                              {c.distance_meters} m
                            </span>
                          </td>
                          <td className="py-2.5">
                            {isInside ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Within 100m
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                                Outside Perimeter
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              {c.has_first_aid_kit && <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              <span>{c.skill}</span>
                            </div>
                          </td>
                          <td className="py-2.5">
                            {response ? (
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {response}
                              </span>
                            ) : broadcastLog && isInside ? (
                              <span className="text-[11px] text-amber-600 font-medium">
                                Alert Delivered &middot; Awaiting Action
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Standby</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Simulated Mobile Alert Experience */}
          <div className="space-y-4">
            
            {/* Simulated Phone Alert */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <Smartphone className="w-4 h-4" /> Passerby Mobile View
                  </span>
                  <span>Push Notification</span>
                </div>

                {/* Simulated Push Banner */}
                <div className="mt-4 bg-slate-800/90 border border-rose-500/40 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                        ⚠️
                      </div>
                      <span className="text-xs font-bold text-white">CrisisSync AI &middot; 100m Alert</span>
                    </div>
                    <span className="text-[10px] text-rose-400 font-mono">Just Now</span>
                  </div>

                  <h4 className="font-bold text-xs text-rose-200 mb-1">
                    URGENT: Emergency within 100m of your location!
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    A severe incident has occurred approximately <strong>51m away</strong> from where you are standing. 
                    If you have first-aid training or an AED/fire extinguisher, please proceed to assist safely. 
                    Otherwise, please keep roadway clear for incoming ambulances.
                  </p>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={() => handleCitizenResponse('EN_ROUTE')}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>🙋 I Can Assist / En Route</span>
                    </button>
                    <button
                      onClick={() => handleCitizenResponse('CLEARING')}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✅ Safe / Clearing Area</span>
                    </button>
                  </div>
                </div>

                {/* Simulation Instruction */}
                <div className="mt-4 p-3 bg-slate-800/50 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-200 block mb-1">How 100m Geofencing Works:</span>
                  1. Coordinates sent from emergency intake trigger GPS boundary search.
                  <br />2. Real-time push notification is dispatched to all mobile devices in 100m.
                  <br />3. Nearby bystander responses feed directly into Tactical Command.
                </div>
              </div>

              {/* Action Buttons to Tactical Command */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <Link to="/command" className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 transition">
                  <span>View in Command Center &rarr;</span>
                </Link>
                <Link to="/report" className="text-slate-400 hover:text-slate-200 transition">
                  <span>Open AI Chatbox</span>
                </Link>
              </div>
            </div>

            {/* Quick Emergency Hotline Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                National Helpline (India)
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-2xl text-slate-900 block">112</span>
                  <span className="text-xs text-slate-500">All-in-one Emergency Assistance</span>
                </div>
                <a
                  href="tel:112"
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call 112</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
