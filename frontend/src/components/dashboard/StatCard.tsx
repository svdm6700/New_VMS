import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  variant?: 'brand' | 'emerald' | 'amber' | 'rose';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  icon: Icon,
  variant = 'brand',
}) => {
  const colorMap = {
    brand: {
      bg: 'bg-brand-50/80 dark:bg-brand-950/40',
      text: 'text-brand-600 dark:text-brand-400',
      border: 'border-brand-100 dark:border-brand-900/50',
    },
    emerald: {
      bg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-900/50',
    },
    amber: {
      bg: 'bg-amber-50/80 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-900/50',
    },
    rose: {
      bg: 'bg-rose-50/80 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-900/50',
    },
  }[variant];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`p-2.5 rounded-xl ${colorMap.bg} ${colorMap.text} ${colorMap.border} border`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{value}</h3>
      </div>
      {sublabel && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
};
