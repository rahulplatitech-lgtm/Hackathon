interface Props { 
  severity: number; 
  className?: string;
  showLabel?: boolean;
}

const SEVERITY_CONFIG: Record<number, { bg: string; text: string; border: string; label: string; dot: string }> = {
  5: { 
    bg: 'bg-red-500/10', 
    text: 'text-red-400', 
    border: 'border-red-500/20', 
    label: 'Critical',
    dot: 'bg-red-500'
  },
  4: { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-400', 
    border: 'border-amber-500/20', 
    label: 'High',
    dot: 'bg-amber-400'
  },
  3: { 
    bg: 'bg-yellow-500/10', 
    text: 'text-yellow-400', 
    border: 'border-yellow-500/20', 
    label: 'Medium',
    dot: 'bg-yellow-400'
  },
  2: { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-400', 
    border: 'border-blue-500/20', 
    label: 'Low',
    dot: 'bg-blue-400'
  },
  1: { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/20', 
    label: 'Minimal',
    dot: 'bg-emerald-400'
  },
};

export default function SeverityBadge({ severity, className = '', showLabel = false }: Props) {
  const conf = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG[3];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${conf.bg} ${conf.text} ${conf.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
      <span>S{severity}</span>
      {showLabel && <span className="opacity-80 text-[11px] ml-0.5">· {conf.label}</span>}
    </span>
  );
}
