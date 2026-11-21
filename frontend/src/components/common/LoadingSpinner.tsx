import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label,
  className = '',
}) => {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 text-slate-500 dark:text-slate-400 ${className}`}>
      <Loader2 className={`${sizeClass} animate-spin text-brand-600 dark:text-brand-400`} />
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
};
