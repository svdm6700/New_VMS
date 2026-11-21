import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileText, Search, Filter } from 'lucide-react';
import { ParagraphItem, PageItem } from '../../types/document';
import { ParagraphCard } from './ParagraphCard';
import { copyToClipboard, downloadText, exportAsDoc } from '../../utils/exportUtils';
import { SearchBar } from '../common/SearchBar';

interface ExtractedTextViewerProps {
  paragraphs: ParagraphItem[];
  pages?: PageItem[];
  documentName?: string;
}

export const ExtractedTextViewer: React.FC<ExtractedTextViewerProps> = ({
  paragraphs,
  pages = [],
  documentName = 'Telugu_Document',
}) => {
  const [query, setQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [copiedAll, setCopiedAll] = useState(false);

  // Available unique pages
  const pageNumbers = useMemo(() => {
    const pSet = new Set<number>();
    paragraphs.forEach((p) => pSet.add(p.Page));
    pages.forEach((p) => pSet.add(p.page));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [paragraphs, pages]);

  // Filtered paragraphs
  const filteredParagraphs = useMemo(() => {
    return paragraphs.filter((p) => {
      const matchPage = selectedPage === 'all' || String(p.Page) === selectedPage;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        (p['Telugu paragraph'] || '').toLowerCase().includes(q) ||
        (p['English translation'] || '').toLowerCase().includes(q) ||
        (p['Heading (Telugu)'] || '').toLowerCase().includes(q) ||
        (p['Heading (English)'] || '').toLowerCase().includes(q);
      return matchPage && matchQuery;
    });
  }, [paragraphs, selectedPage, query]);

  const handleCopyAll = async () => {
    const textLines = filteredParagraphs.map((p) => {
      const parts = [`--- Page ${p.Page} ---`];
      if (p['Heading (Telugu)']) parts.push(`[${p['Heading (Telugu)']}]`);
      if (p['Telugu paragraph']) parts.push(p['Telugu paragraph']);
      if (p['Heading (English)']) parts.push(`English: [${p['Heading (English)']}]`);
      if (p['English translation']) parts.push(`English: ${p['English translation']}`);
      return parts.join('\n');
    });

    const success = await copyToClipboard(textLines.join('\n\n'));
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    const text = filteredParagraphs
      .map((p) => `Page ${p.Page}:\n${p['Telugu paragraph'] || ''}\n\nTranslation:\n${p['English translation'] || ''}`)
      .join('\n\n====================\n\n');
    downloadText(text, `${documentName}_extracted.txt`);
  };

  const handleDownloadDoc = () => {
    const html = filteredParagraphs
      .map(
        (p) => `
        <div style="margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #ccc;">
          <h4 style="color: #0358a1;">Page ${p.Page}</h4>
          ${p['Heading (Telugu)'] ? `<h5>${p['Heading (Telugu)']}</h5>` : ''}
          <p style="font-size: 14px;">${p['Telugu paragraph'] || ''}</p>
          ${p['English translation'] ? `<p style="font-size: 13px; color: #555; font-style: italic;"><strong>Translation:</strong> ${p['English translation']}</p>` : ''}
        </div>`
      )
      .join('');
    exportAsDoc(`Telugu PDF Analysis: ${documentName}`, html, `${documentName}_extracted.doc`);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search Telugu or English text..."
            className="flex-1"
          />

          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Pages ({paragraphs.length})</option>
            {pageNumbers.map((p) => (
              <option key={p} value={String(p)}>
                Page {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>
          <button
            onClick={handleDownloadTxt}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Download Plain Text"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>TXT</span>
          </button>
          <button
            onClick={handleDownloadDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            title="Download Word Document"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOCX</span>
          </button>
        </div>
      </div>

      {/* Paragraphs list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {!filteredParagraphs.length ? (
          <div className="text-center py-12 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
            {query ? 'No paragraphs matching your search query.' : 'No extracted text paragraphs found for this document.'}
          </div>
        ) : (
          filteredParagraphs.map((para, index) => (
            <ParagraphCard key={index} para={para} searchQuery={query} />
          ))
        )}
      </div>
    </div>
  );
};
