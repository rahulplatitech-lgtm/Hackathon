interface Props { 
  status: string; 
  className?: string;
}

const STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  AVAILABLE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  ASSIGNED: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  EN_ROUTE: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/25',
    dot: 'bg-sky-500',
  },
  ON_SCENE: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/25',
    dot: 'bg-purple-500',
  },
  UNAVAILABLE: {
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700/50',
    dot: 'bg-slate-500',
  },
  ACTIVE: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  RESOLVED: {
    bg: 'bg-slate-800/60',
    text: 'text-slate-400',
    border: 'border-slate-700/40',
    dot: 'bg-slate-500',
  },
};

export default function StatusBadge({ status, className = '' }: Props) {
  const norm = (status || '').toUpperCase();
  const conf = STYLES[norm] || {
    bg: 'bg-slate-800/60',
    text: 'text-slate-400',
    border: 'border-slate-700/50',
    dot: 'bg-slate-500',
  };

  const formatted = norm.replace(/_/g, ' ').toLowerCase();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${conf.bg} ${conf.text} ${conf.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
      <span>{formatted}</span>
    </span>
  );
}
