import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

export default function Banner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-slate-900 border-b border-slate-800/80 text-xs text-slate-400 px-4 py-1.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Emergency Coordination Platform &middot; Interactive Simulation Environment</span>
      </div>
      <button 
        onClick={() => setVisible(false)} 
        className="text-slate-500 hover:text-slate-300 transition p-0.5 rounded"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
