import React, { useState } from 'react';
import { Copy, Check, Languages } from 'lucide-react';
import { ParagraphItem } from '../../types/document';
import { copyToClipboard } from '../../utils/exportUtils';

interface ParagraphCardProps {
  para: ParagraphItem;
  searchQuery?: string;
}

export const ParagraphCard: React.FC<ParagraphCardProps> = ({ para, searchQuery }) => {
  const [copied, setCopied] = useState(false);

  const headingTe = para['Heading (Telugu)'];
  const headingEn = para['Heading (English)'];
  const textTe = para['Telugu paragraph'] || '';
  const textEn = para['English translation'] || '';

  const handleCopy = async () => {
    const fullText = [
      headingTe ? `[${headingTe}]` : '',
      textTe,
      headingEn ? `[${headingEn}]` : '',
      textEn ? `(Translation: ${textEn})` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const success = await copyToClipboard(fullText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const highlight = (text: string) => {
    if (!searchQuery || !searchQuery.trim()) return text;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-800/60 dark:text-amber-100 rounded-xs px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-brand-300 dark:hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold text-[10px]">
            Page {para.Page}
          </span>
          {headingTe && (
            <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-xs">
              {headingTe}
            </h5>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          title="Copy paragraph"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Telugu Text */}
      <div className="mb-3">
        <p className="text-xs leading-relaxed text-slate-900 dark:text-slate-100 font-normal font-telugu whitespace-pre-wrap">
          {highlight(textTe)}
        </p>
      </div>

      {/* English Translation */}
      {textEn && (
        <div className="pt-2.5 mt-2 border-t border-dashed border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 rounded-lg">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-brand-600 dark:text-brand-400 mb-1">
            <Languages className="w-3 h-3" />
            <span>English Translation</span>
          </div>
          {headingEn && <h6 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{headingEn}</h6>}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic whitespace-pre-wrap">
            {highlight(textEn)}
          </p>
        </div>
      )}
    </div>
  );
};
