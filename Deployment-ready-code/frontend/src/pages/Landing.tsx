import { Link } from 'react-router-dom';
import { 
  Shield, AlertTriangle, LayoutDashboard, Users, FlaskConical, Zap, 
  Brain, MapPin, Radio, ArrowRight, ChevronRight, Lock
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12">
      <div className="max-w-5xl mx-auto w-full space-y-12 my-auto">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Autonomous Emergency Response Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Intelligent Crisis Command & Resource Coordination
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Multi-agent emergency dispatch powered by conversational AI, real-time Google Maps telemetry, and mathematical constraint optimization.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link 
              to="/command" 
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Launch Command Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link 
              to="/report" 
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-medium transition shadow-sm"
            >
              <Radio className="w-4 h-4" />
              <span>Launch Emergency Chatbox</span>
            </Link>
          </div>
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link 
            to="/report" 
            className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Emergency AI Chatbox
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive voice & text intake: describe emergencies, receive live guidance, and auto-transition to Tactical Command.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200">
              <span>Open Chatbox</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          <Link 
            to="/command" 
            className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Command Center
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live Google Maps radar, active incident queue, Help Near Me fleet telemetry, and response plans.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200">
              <span>Open Cockpit</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          <Link 
            to="/operator" 
            className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Operator Triage
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Human-in-the-loop review for low-confidence calls, transcript inspection, and authorization.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200">
              <span>View Queue</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          <Link 
            to="/simulation" 
            className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <FlaskConical className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Scenario Simulation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive test sandbox: inject critical incidents, simulate unit breakdowns, and trigger dynamic replanning.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200">
              <span>Open Simulator</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>

        {/* System Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
            <div className="font-semibold text-slate-200 mb-0.5 flex items-center justify-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" /> Multi-Agent AI
            </div>
            <p className="text-slate-400 text-[11px]">Gemini 2.5 voice & classification</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
            <div className="font-semibold text-slate-200 mb-0.5 flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> OR-Tools Solver
            </div>
            <p className="text-slate-400 text-[11px]">Linear constraint optimization</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
            <div className="font-semibold text-slate-200 mb-0.5 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" /> Reserve Guardrail
            </div>
            <p className="text-slate-400 text-[11px]">Guaranteed standby backup units</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
            <div className="font-semibold text-slate-200 mb-0.5 flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> Google Maps API
            </div>
            <p className="text-slate-400 text-[11px]">Live geolocation & routing</p>
          </div>
        </div>
      </div>
    </div>
  );
}
