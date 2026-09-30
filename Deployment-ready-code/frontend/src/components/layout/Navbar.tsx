import { Link, useLocation } from 'react-router-dom';
import { Shield, Radio, LayoutDashboard, FlaskConical, Heart, Compass, Bell } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

const NAV = [
  { to: '/', label: 'Overview', icon: Heart },
  { to: '/nearby', label: 'Nearby Help', icon: Compass },
  { to: '/report', label: 'Emergency AI Chatbox', icon: Radio },
  { to: '/command', label: 'Command Center', icon: LayoutDashboard },
  { to: '/passerby', label: '100m Alerts', icon: Bell },
  { to: '/simulation', label: 'Simulation', icon: FlaskConical },
];

export default function Navbar() {
  const location = useLocation();
  const { status } = useWebSocket();

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between z-50 sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
            <Heart className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block leading-tight">
              CrisisSync AI
            </span>
            <span className="text-[11px] text-slate-400 block leading-tight">
              Emergency Response Platform
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(n => {
            const isActive = location.pathname === n.to;
            return (
              <Link 
                key={n.to} 
                to={n.to}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <n.icon className={`w-3.5 h-3.5 ${isActive ? 'text-red-400' : 'text-slate-400'}`} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Live System Indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-full text-xs text-slate-300">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'LIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-medium text-slate-400">
            {status === 'LIVE' ? 'System Online' : 'Connecting'}
          </span>
        </div>
      </div>
    </nav>
  );
}
