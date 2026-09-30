import React from 'react';
import { Link } from 'react-router-dom';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="bg-red-500 text-white text-center text-xs py-1 font-bold">
        PROTOTYPE - Not for real emergency use
      </div>
      <header className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-red-500">Crisis Command AI</Link>
          <nav className="flex gap-4">
            <Link to="/report" className="hover:text-red-400">Report</Link>
            <Link to="/operator" className="hover:text-red-400">Operator</Link>
            <Link to="/command" className="hover:text-red-400">Command Center</Link>
            <Link to="/simulation" className="hover:text-red-400">Simulation</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
