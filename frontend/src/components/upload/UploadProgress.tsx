import React from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  stage: string;
  filename: string;
  onCancel?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  stage,
  filename,
  onCancel,
}) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
              {filename}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{stage}</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
        <div
          className="bg-brand-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(5, progress)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
        <span>Processing pipeline</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
};
