import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Heart, Shield, MapPin, Radio, Phone, Compass, Info, ArrowRight, 
  Plus, Minus, Navigation, Bell, Activity, Truck, Building2, Flame,
  AlertTriangle, PhoneCall, CheckCircle2, ChevronRight, Sparkles, Mic
} from 'lucide-react';
import { APIProvider, Map, Marker, Circle, InfoWindow } from '@vis.gl/react-google-maps';

export default function Landing() {
  const navigate = useNavigate();
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [liveTime, setLiveTime] = useState<string>('');

  // Delhi / Connaught Place example coordinates from Image 3
  const centerPos = { lat: 28.6315, lng: 77.2167 };
  const [zoomLevel, setZoomLevel] = useState(15);

  // Live localized Indian time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      setLiveTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sample map markers matching Image 3 (Janpath, Barakhamba, Mandi House, Bengali Market)
  const mapOutlets = [
    { id: '1', name: 'Connaught Central Hospital', type: 'HOSPITAL', lat: 28.6335, lng: 77.2185, symbol: '🏥', color: '#dc2626' },
    { id: '2', name: 'Barakhamba Ambulance Station', type: 'AMBULANCE', lat: 28.6310, lng: 77.2215, symbol: '🚑', color: '#059669' },
    { id: '3', name: 'Janpath Metro AED Kiosk', type: 'AED', lat: 28.6285, lng: 77.2170, symbol: '❤️', color: '#d97706' },
    { id: '4', name: 'Mandi House Police Post', type: 'POLICE', lat: 28.6265, lng: 77.2230, symbol: '🛡️', color: '#2563eb' },
    { id: '5', name: 'Bengali Market First Aid Center', type: 'CLINIC', lat: 28.6275, lng: 77.2260, symbol: '➕', color: '#059669' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      
      {/* Top Header Bar (Matching Image 3) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Emergency overview
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            CrisisSync AI &middot; Interactive concept &amp; platform
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Demo Mode Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>DEMO MODE</span>
          </div>

          {/* Time Badge */}
          <div className="text-xs font-medium text-slate-500 hidden sm:block">
            India &middot; {liveTime || '12:12 am'}
          </div>

          {/* SOS Pill Button */}
          <button
            onClick={() => setSosModalOpen(true)}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition transform hover:scale-[1.02]"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>SOS</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Shell (Workspace Sidebar | Interactive Map with SOS | Quick Access Panel) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Workspace Sidebar (Matching Image 3) */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                <Heart className="w-5 h-5 fill-white text-white" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 block leading-tight tracking-tight">
                  CrisisSync AI
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                  EMERGENCY PLATFORM
                </span>
              </div>
            </div>

            {/* Navigation Menu */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
                WORKSPACE
              </span>
              <nav className="space-y-1 text-xs font-semibold">
                <Link
                  to="/"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-50 text-red-700 font-bold transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-red-600" />
                    <span>Overview</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                </Link>

                <Link
                  to="/nearby"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  <Compass className="w-4 h-4 text-slate-400" />
                  <span>Nearby help</span>
                </Link>

                <Link
                  to="/report"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  <Radio className="w-4 h-4 text-slate-400" />
                  <span>Emergency AI Chatbox</span>
                </Link>

                <Link
                  to="/command"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Command Center</span>
                </Link>

                <Link
                  to="/passerby"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>Passerby 100m Alerts</span>
                </Link>

                <Link
                  to="/simulation"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span>Simulation Sandbox</span>
                </Link>
              </nav>
            </div>
          </div>

          {/* Bottom Alert Card on Sidebar (Matching Image 3) */}
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold mb-1">
                <Info className="w-4 h-4 text-blue-500" />
                <span>In a real emergency</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
                This is a concept demo. It does not contact emergency services.
              </p>
              <a
                href="tel:112"
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition"
              >
                <span>Call 112 directly</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            <div className="text-[10px] font-semibold text-slate-400 px-1">
              EMERGENCY EXPERIENCE &middot; 01 / 04
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Interactive Map with Pulsing SOS Button (Matching Image 3) */}
        <main className="flex-1 relative bg-slate-100 flex flex-col overflow-hidden min-h-[500px]">
          
          {/* Floating Location Card at Top-Left of Map */}
          <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-2xl p-3 shadow-md text-xs max-w-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>EXAMPLE LOCATION</span>
            </div>
            <div className="font-bold text-sm text-slate-900">
              Connaught Place &middot; New Delhi (example)
            </div>
          </div>

          {/* Zoom Controls at Top-Right of Map */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
            <button
              onClick={() => setZoomLevel(prev => Math.min(19, prev + 1))}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-slate-900 flex items-center justify-center font-bold transition hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(12, prev - 1))}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-slate-900 flex items-center justify-center font-bold transition hover:bg-slate-50"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(15)}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-slate-900 flex items-center justify-center transition hover:bg-slate-50"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Google Map with Light Style */}
          <div className="flex-1 w-full h-full relative">
            <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
              <Map
                center={centerPos}
                zoom={zoomLevel}
                mapId="DEMO_MAP_ID"
                disableDefaultUI={true}
                className="w-full h-full"
              >
                {/* 100m Geofence Perimeter around center */}
                <Circle
                  center={centerPos}
                  radius={100}
                  fillColor="#f43f5e"
                  fillOpacity={0.15}
                  strokeColor="#e11d48"
                  strokeOpacity={0.7}
                  strokeWeight={1.5}
                />

                {/* Map Outlets from Image 3 */}
                {mapOutlets.map(outlet => {
                  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="30" height="30">
                    <rect x="2" y="2" width="30" height="30" rx="9" fill="#ffffff" stroke="${outlet.color}" stroke-width="2"/>
                    <text x="17" y="21" font-size="13" text-anchor="middle">${outlet.symbol}</text>
                  </svg>`;
                  return (
                    <Marker
                      key={outlet.id}
                      position={{ lat: outlet.lat, lng: outlet.lng }}
                      title={outlet.name}
                      icon={{ url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}` }}
                    />
                  );
                })}

                {/* Center User Location Marker */}
                <Marker
                  position={centerPos}
                  title="Your Location / Example Center"
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>
                        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                      </svg>
                    `)}`
                  }}
                />
              </Map>
            </APIProvider>

            {/* Road Label Landmarks from Image 3 */}
            <div className="absolute top-28 right-24 pointer-events-none text-xs font-bold text-slate-500/80 uppercase tracking-wider">
              JANPATH
            </div>
            <div className="absolute top-44 left-1/3 pointer-events-none text-xs font-bold text-slate-500/80 uppercase tracking-wider">
              BARAKHAMBA RD
            </div>
            <div className="absolute bottom-28 right-28 pointer-events-none text-xs font-bold text-slate-500/80 uppercase tracking-wider">
              MANDI HOUSE
            </div>
            <div className="absolute bottom-12 left-1/4 pointer-events-none text-xs font-bold text-slate-500/80 uppercase tracking-wider">
              BENGALI MARKET
            </div>

            {/* Central Pulsing SOS Button (Matching Image 3) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="relative pointer-events-auto flex flex-col items-center">
                
                {/* Glowing Outer Ripple Circles */}
                <span className="absolute -inset-4 rounded-full bg-red-500/20 animate-ping opacity-75" />
                <span className="absolute -inset-8 rounded-full bg-red-400/10 animate-pulse" />

                {/* Main SOS Circular Button */}
                <button
                  onClick={() => setSosModalOpen(true)}
                  className="w-36 h-36 rounded-full bg-gradient-to-tr from-red-600 to-red-500 text-white shadow-2xl shadow-red-600/50 flex flex-col items-center justify-center transition transform active:scale-95 hover:scale-105 border-4 border-white cursor-pointer select-none group"
                >
                  <span className="text-3xl font-black tracking-wider text-white drop-shadow-sm group-hover:scale-110 transition-transform">
                    SOS
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-100 mt-0.5">
                    TAP FOR HELP
                  </span>
                </button>

                {/* Subtitle Under SOS */}
                <div className="mt-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-xs">
                  Example center &middot; 100m Geofence Active
                </div>
              </div>
            </div>

            {/* Bottom Footnote */}
            <div className="absolute bottom-3 left-4 text-[10px] text-slate-500 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80">
              Interactive map illustration &middot; Locations and travel times are examples
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: Quick Access & Emergency Hotline (Matching Image 3) */}
        <aside className="w-80 bg-white border-l border-slate-200 p-5 hidden lg:flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-5">
            
            {/* Header */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  QUICK ACCESS
                </span>
                <Activity className="w-4 h-4 text-red-500" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Choose your next step
              </h2>
            </div>

            {/* 3 Action Cards (Matching Image 3) */}
            <div className="space-y-3">
              
              {/* Card 1: E-Services (Green) */}
              <Link
                to="/report"
                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                      E-Services
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Emergency AI intake &amp; dispatch
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
              </Link>

              {/* Card 2: Nearby help (Amber) */}
              <Link
                to="/nearby"
                className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition">
                      Nearby help
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Hospitals, AEDs &amp; Ambulances
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
              </Link>

              {/* Card 3: Notify passerby (Rose) */}
              <Link
                to="/passerby"
                className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition">
                      Notify passerby
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      100m radius mobile citizen alert
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition" />
              </Link>

            </div>

          </div>

          {/* Dark Navy Emergency Line Card at Bottom-Right (Matching Image 3) */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>EMERGENCY LINE</span>
            </div>

            <div>
              <span className="font-black text-4xl tracking-tight text-white block">
                112
              </span>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Need immediate assistance in India? Call the national emergency number directly.
              </p>
            </div>

            <a
              href="tel:112"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call emergency line &rarr;</span>
            </a>
          </div>

        </aside>

      </div>

      {/* SOS Quick Action Modal Overlay */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border-2 border-red-100">
              <Activity className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="font-black text-2xl text-slate-900 tracking-tight">
              Emergency Assistance Activated
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              CrisisSync AI is ready to triage, alert nearby citizens within 100m, and dispatch emergency responders.
            </p>

            <div className="space-y-3">
              <Link
                to="/report?voice=true"
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-red-600/30 animate-pulse"
              >
                <Mic className="w-5 h-5 text-white" />
                <span>Start Interactive Voice Bot (ChatGPT Style)</span>
              </Link>

              <Link
                to="/report"
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Radio className="w-4 h-4 text-slate-600" />
                <span>Open Emergency Chatbox (Text & Voice)</span>
              </Link>

              <Link
                to="/passerby"
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl text-xs border border-rose-200 flex items-center justify-center gap-2 transition"
              >
                <Bell className="w-4 h-4" />
                <span>Broadcast 100m Passerby Alert</span>
              </Link>

              <a
                href="tel:112"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call 112 National Line</span>
              </a>
            </div>

            <button
              onClick={() => setSosModalOpen(false)}
              className="mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
