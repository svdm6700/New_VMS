import React, { useState } from 'react';
import { ScanEye, Copy, Check, Download, FileText, CheckCircle2 } from 'lucide-react';
import { PageItem, ValidationInfo } from '../../types/document';
import { copyToClipboard, downloadText } from '../../utils/exportUtils';
import { SearchBar } from '../common/SearchBar';

interface OCRResultViewerProps {
  pages: PageItem[];
  validation?: ValidationInfo;
  documentName?: string;
}

export const OCRResultViewer: React.FC<OCRResultViewerProps> = ({
  pages,
  validation,
  documentName = 'Document',
}) => {
  const [query, setQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Filter OCR pages
  const ocrPages = pages.filter((p) => p.method.includes('OCR') || p.method.includes('Tesseract'));
  const allDisplayPages = ocrPages.length > 0 ? ocrPages : pages;

  const filtered = allDisplayPages.filter((p) => {
    if (!query) return true;
    return p.text.toLowerCase().includes(query.toLowerCase());
  });

  const handleCopyPage = async (text: string, index: number) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleDownloadAllOcr = () => {
    const combined = allDisplayPages
      .map((p) => `--- Page ${p.page} [${p.method}] ---\n\n${p.text}`)
      .join('\n\n====================\n\n');
    downloadText(combined, `${documentName}_ocr_text.txt`);
  };

  return (
    <div className="space-y-4">
      {/* Header Stat & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              OCR Engine: Tesseract Telugu + English (`tel+eng`)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {ocrPages.length} scanned pages recognized out of {pages.length} total pages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Search OCR text..." className="w-48" />
          <button
            onClick={handleDownloadAllOcr}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All OCR</span>
          </button>
        </div>
      </div>

      {/* Pages list */}
      <div className="grid grid-cols-1 gap-4">
        {!filtered.length ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
            <ScanEye className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p>No scanned OCR content matching criteria.</p>
          </div>
        ) : (
          filtered.map((page, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-bold text-xs">
                    Page {page.page}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                    Method: {page.method}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recognized
                  </span>
                </div>

                <button
                  onClick={() => handleCopyPage(page.text, idx)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedIndex === idx ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              {/* Text content */}
              <div className="p-4 bg-slate-50/70 dark:bg-slate-950/50 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-telugu whitespace-pre-wrap">
                  {page.text || <span className="italic text-slate-400">No readable text on this page.</span>}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
