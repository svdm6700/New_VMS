import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ExternalLink,
} from 'lucide-react';

interface PDFToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen?: () => void;
  fileUrl?: string;
}

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  currentPage,
  totalPages,
  scale,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  fileUrl,
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 rounded-t-xl text-xs">
      {/* Page Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          Page <span className="font-bold">{currentPage}</span> of {totalPages || 1}
        </span>
        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom and View Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetZoom}
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Fit to page"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Open original PDF in browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-1"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
