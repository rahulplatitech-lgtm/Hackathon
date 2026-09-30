import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Search, MapPin, Phone, Navigation, Heart, Shield, 
  Clock, Plus, CheckCircle2, AlertTriangle, Building2, Truck
} from 'lucide-react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { useQuery } from '@tanstack/react-query';
import { getEmergencyOutlets } from '../lib/api/passerby';
import type { EmergencyOutlet } from '../types';

const CATEGORIES = ['All', 'Hospital', 'Ambulance', 'AED', 'Police', 'Pharmacy'];

// Custom SVG map icons matching Image 5
const getOutletMapIcon = (type: string) => {
  let color = '#dc2626'; // red
  let symbol = 'H';
  if (type === 'AMBULANCE') { color = '#059669'; symbol = '🚑'; }
  else if (type === 'AED') { color = '#d97706'; symbol = '❤️'; }
  else if (type === 'POLICE') { color = '#2563eb'; symbol = '🛡️'; }
  else if (type === 'PHARMACY') { color = '#7c3aed'; symbol = '💊'; }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="34" height="34">
    <rect x="2" y="2" width="32" height="32" rx="10" fill="#ffffff" stroke="${color}" stroke-width="2.5"/>
    <text x="18" y="22" font-size="14" text-anchor="middle">${symbol}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function NearbyHelp() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOutlet, setSelectedOutlet] = useState<EmergencyOutlet | null>(null);
  const [callModal, setCallModal] = useState<EmergencyOutlet | null>(null);

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['emergencyOutlets'],
    queryFn: () => getEmergencyOutlets(12.9716, 77.5946),
  });

  const filteredOutlets = useMemo(() => {
    return outlets.filter(item => {
      const matchesCategory = 
        selectedCategory === 'All' || 
        item.type.toUpperCase() === selectedCategory.toUpperCase();
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.area.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [outlets, selectedCategory, searchQuery]);

  const mapCenter = useMemo(() => {
    if (filteredOutlets.length > 0) {
      return { lat: filteredOutlets[0].latitude, lng: filteredOutlets[0].longitude };
    }
    return { lat: 12.9716, lng: 77.5946 };
  }, [filteredOutlets]);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'HOSPITAL':
        return <Building2 className="w-5 h-5 text-red-600" />;
      case 'AMBULANCE':
        return <Truck className="w-5 h-5 text-emerald-600" />;
      case 'AED':
        return <Heart className="w-5 h-5 text-amber-500" />;
      case 'POLICE':
        return <Shield className="w-5 h-5 text-blue-600" />;
      case 'PHARMACY':
      default:
        return <Plus className="w-5 h-5 text-purple-600" />;
    }
  };

  const getCategoryBg = (type: string) => {
    switch (type) {
      case 'HOSPITAL':
        return 'bg-red-50 border-red-100';
      case 'AMBULANCE':
        return 'bg-emerald-50 border-emerald-100';
      case 'AED':
        return 'bg-amber-50 border-amber-100';
      case 'POLICE':
        return 'bg-blue-50 border-blue-100';
      case 'PHARMACY':
      default:
        return 'bg-purple-50 border-purple-100';
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-800 pb-16">
      {/* Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* Navigation Breadcrumb */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to overview</span>
        </Link>

        {/* Page Header (Matching Image 5) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block mb-1">
              LOCAL SUPPORT
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Help around you.
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Explore illustrative emergency outlets around central New Delhi & Bangalore.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-xs text-xs text-slate-600 self-start sm:self-auto">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <span className="font-medium">Connaught Place, New Delhi (example)</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Interactive Map Box */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm h-72 sm:h-80 mb-8">
          <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              center={mapCenter}
              zoom={14}
              mapId="DEMO_MAP_ID"
              disableDefaultUI={true}
              zoomControl={true}
              className="w-full h-full"
            >
              {filteredOutlets.map(outlet => (
                <Marker
                  key={outlet.id}
                  position={{ lat: outlet.latitude, lng: outlet.longitude }}
                  title={outlet.name}
                  icon={getOutletMapIcon(outlet.type)}
                  onClick={() => setSelectedOutlet(outlet)}
                />
              ))}

              {selectedOutlet && (
                <InfoWindow
                  position={{ lat: selectedOutlet.latitude, lng: selectedOutlet.longitude }}
                  onCloseClick={() => setSelectedOutlet(null)}
                >
                  <div className="p-2 text-xs max-w-xs text-slate-800">
                    <div className="font-bold text-sm text-slate-900">{selectedOutlet.name}</div>
                    <div className="text-slate-500 text-[11px] mb-1.5">{selectedOutlet.area}</div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-2">
                      <span>{selectedOutlet.distance_km} km</span>
                      <span className="text-emerald-600">~{selectedOutlet.eta_minutes} min ETA</span>
                    </div>
                    <button
                      onClick={() => setCallModal(selectedOutlet)}
                      className="w-full py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded text-center transition"
                    >
                      Call {selectedOutlet.phone}
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Floating Map Overlay Label */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-800">Nearby emergency help &middot; CrisisSync AI</span>
          </div>

          <div className="absolute bottom-2 left-3 text-[10px] text-slate-500 bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded">
            Illustrative map &middot; not live navigation
          </div>
        </div>

        {/* Nearby Outlets Listing Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Nearby outlets ({filteredOutlets.length})
            </h2>
            <p className="text-xs text-slate-400">Example listings around active perimeter</p>
          </div>

          {/* Search bar matching Image 5 */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search by name or area"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            />
          </div>
        </div>

        {/* Outlet Cards List */}
        <div className="space-y-3">
          {filteredOutlets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No emergency outlets found matching "{searchQuery}" in {selectedCategory}.
            </div>
          ) : (
            filteredOutlets.map(outlet => (
              <div 
                key={outlet.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${getCategoryBg(outlet.type)}`}>
                    {getCategoryIcon(outlet.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {outlet.type}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-red-600 transition">
                      {outlet.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {outlet.area}
                    </p>

                    {/* Capabilities Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {outlet.capabilities.slice(0, 3).map((c, i) => (
                        <span key={i} className="text-[10px] bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right details & action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="font-extrabold text-sm text-slate-900 block">{outlet.distance_km} km</span>
                    <span className="text-xs text-emerald-600 font-medium">~{outlet.eta_minutes} min</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setCallModal(outlet)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </button>
                    <Link
                      to={`/command`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Navigation className="w-3 h-3 text-slate-500" />
                      <span>Route</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Call Dialog Modal */}
      {callModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Phone className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">{callModal.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{callModal.area}</p>

            <div className="my-5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 block mb-1">Direct Emergency Hotline</span>
              <a href={`tel:${callModal.phone}`} className="font-mono text-xl font-bold text-red-600 hover:underline">
                {callModal.phone}
              </a>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${callModal.phone}`}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition"
              >
                Call Now
              </a>
              <button
                onClick={() => setCallModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
