import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  Camera,
  User,
  Eye,
} from 'lucide-react';
import { ExtractedRecord, DocumentResult } from '../../types/document';
import { extractRecordsFromDocument } from '../../utils/recordParser';
import { copyToClipboard, downloadCsv, downloadBlob } from '../../utils/exportUtils';
import { documentService } from '../../services/documentService';
import { SearchBar } from '../common/SearchBar';

interface StructuredDataViewerProps {
  document: DocumentResult | null;
  className?: string;
}

export const StructuredDataViewer: React.FC<StructuredDataViewerProps> = ({
  document,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Extract records dynamically from document
  const records: ExtractedRecord[] = useMemo(() => {
    return extractRecordsFromDocument(document);
  }, [document]);

  // Unique pages
  const availablePages = useMemo(() => {
    const s = new Set<number>();
    records.forEach((r) => s.add(r.page));
    return Array.from(s).sort((a, b) => a - b);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records
      .filter((rec) => {
        const matchPage = selectedPage === 'all' || String(rec.page) === selectedPage;
        if (!matchPage) return false;
        if (!query.trim()) return true;

        const q = query.toLowerCase();
        return rec.fields.some(
          (f) => f.field_name.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
        );
      })
      .map((rec) => {
        // If query is present, keep matching fields or all fields in matching record
        if (!query.trim()) return rec;
        const q = query.toLowerCase();
        return {
          ...rec,
          fields: rec.fields.filter(
            (f) => f.field_name.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
          ),
        };
      })
      .filter((rec) => rec.fields.length > 0);
  }, [records, selectedPage, query]);

  // Total extracted fields
  const totalFields = useMemo(() => {
    return records.reduce((acc, r) => acc + r.fields.length, 0);
  }, [records]);

  const handleCopyFieldValue = async (val: string, keyId: string) => {
    const success = await copyToClipboard(val);
    if (success) {
      setCopiedField(keyId);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCopyAllData = async () => {
    if (!filteredRecords.length) return;
    const textBlocks = filteredRecords.map((rec) => {
      const header = `=== ${rec.title || `Record ${rec.record_id}`} (Page ${rec.page}) ===`;
      const rows = rec.fields.map((f) => `${f.field_name}\t: ${f.value}`).join('\n');
      return `${header}\n${rows}`;
    });

    const success = await copyToClipboard(textBlocks.join('\n\n'));
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleDownloadCsv = () => {
    if (!filteredRecords.length) return;
    const rows: { [key: string]: any }[] = [];
    filteredRecords.forEach((rec) => {
      rec.fields.forEach((f) => {
        rows.push({
          'Page': rec.page,
          'Record ID': rec.record_id,
          'Field Name': f.field_name,
          'Extracted Value': f.value,
        });
      });
    });
    downloadCsv(rows, `${document?.metadata?.filename || 'Telugu_Data'}_structured_records.csv`);
  };

  const handleDownloadExcel = async () => {
    if (!document) return;
    try {
      const blob = await documentService.exportExcel(document);
      downloadBlob(blob, `${document.metadata?.filename || 'Telugu_Data'}_extracted_data.xlsx`);
    } catch (err: any) {
      alert(`Excel export error: ${err.message}`);
    }
  };

  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Telugu PDF Extracted Data - ${document?.metadata?.filename || 'Analysis'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Noto Sans Telugu', system-ui, sans-serif; padding: 24px; color: #111; line-height: 1.5; }
          h2 { color: #026fc7; margin-bottom: 4px; font-size: 20px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
          .record-card { margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
          .record-head { background: #f1f5f9; padding: 8px 12px; font-weight: bold; font-size: 13px; border-bottom: 1px solid #cbd5e1; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 8px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
          th { width: 35%; background: #fafafa; font-weight: 600; color: #334155; }
          td { width: 65%; color: #0f172a; }
          tr:last-child th, tr:last-child td { border-bottom: none; }
        </style>
      </head>
      <body>
        <h2>Telugu Document Extracted Data</h2>
        <div class="meta">
          <strong>Document:</strong> ${document?.metadata?.filename || 'PDF'} &nbsp;|&nbsp; 
          <strong>Records:</strong> ${filteredRecords.length} &nbsp;|&nbsp; 
          <strong>Extracted Fields:</strong> ${totalFields}
        </div>
        ${filteredRecords
          .map(
            (rec) => `
            <div class="record-card">
              <div class="record-head">${rec.title || `Record ${rec.record_id}`} — Page ${rec.page}</div>
              <table>
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Extracted Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${rec.fields
                    .map(
                      (f) => `
                      <tr>
                        <th>${f.field_name}</th>
                        <td>${f.value}</td>
                      </tr>
                    `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          )
          .join('')}
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400">
        <AlertCircle className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Structured Fields Detected</h4>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Upload a Telugu document or voter list to view its fields in this 2-column format.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Location Details Pill */}
      {(document?.metadata?.district || (document as any)?.district) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50 rounded-2xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 font-telugu">
              📍 ప్రాంత వివరాలు (Location Details):
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-medium text-slate-700 dark:text-slate-300 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <strong>జిల్లా:</strong> {document?.metadata?.district || (document as any)?.district || 'N/A'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <strong>నియోజకవర్గం:</strong> {document?.metadata?.constituency || (document as any)?.constituency || 'N/A'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <strong>గ్రామం/ప్రాంతం:</strong> {document?.metadata?.area || (document as any)?.area || 'N/A'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <strong>వార్డు:</strong> {document?.metadata?.ward_number || (document as any)?.ward_number || 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search Field Name or Value..."
            className="flex-1"
          />

          {availablePages.length > 1 && (
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Pages ({availablePages.length})</option>
              {availablePages.map((p) => (
                <option key={p} value={String(p)}>
                  Page {p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Buttons: Copy All, CSV, Excel, Print/PDF */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleCopyAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Copy all records as text"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            title="Download Excel Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Badge */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>
          Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRecords.length}</span> record(s) ·{' '}
          <span className="font-bold text-slate-800 dark:text-slate-200">{totalFields}</span> total extracted fields
        </span>
        <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">
          Original Telugu Unicode Preserved
        </span>
      </div>

      {/* Structured 2-Column Tables (One Card per Voter / Record) */}
      <div className="space-y-4">
        {filteredRecords.map((rec) => (
          <div
            key={rec.record_id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
          >
            {/* Record Header */}
            <div className="bg-slate-50/80 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-telugu">
                  {rec.title || `రికార్డు ${rec.record_id}`}
                </h4>
                <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[10px] font-semibold">
                  పేజీ {rec.page}
                </span>
                {rec.image_matching_status && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      rec.image_matching_status === 'MATCHED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : rec.image_matching_status === 'NEEDS_VERIFICATION'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {rec.image_matching_status === 'MATCHED' && <CheckCircle2 className="w-3 h-3" />}
                    {rec.image_matching_status === 'NEEDS_VERIFICATION' && <AlertCircle className="w-3 h-3" />}
                    {rec.image_matching_status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {rec.photo_path && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                    <Camera className="w-3 h-3" /> Photo Saved
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">
                  {rec.fields.length} Fields
                </span>
              </div>
            </div>

            {/* 2-Column Table: Field Name | Extracted Value */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-bold">
                    <th className="py-2.5 px-5 w-2/5 sm:w-1/3">Field Name</th>
                    <th className="py-2.5 px-5 w-3/5 sm:w-2/3">Extracted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-100 font-telugu">
                  {rec.fields.map((f, fIdx) => {
                    const rowKey = `${rec.record_id}-${fIdx}`;
                    const isCopied = copiedField === rowKey;
                    const isNA = f.value === 'Not Available' || !f.value;

                    return (
                      <tr
                        key={fIdx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Field Name */}
                        <td className="py-3 px-5 font-semibold text-slate-700 dark:text-slate-300 align-top bg-slate-50/30 dark:bg-slate-900/30 border-r border-slate-100 dark:border-slate-800/60">
                          {f.field_name}
                        </td>

                        {/* Extracted Value with Copy Action */}
                        <td className="py-3 px-5 align-top">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={`leading-relaxed whitespace-pre-wrap break-words ${
                                isNA ? 'text-slate-400 italic font-sans' : 'text-slate-900 dark:text-slate-50 font-medium'
                              }`}
                            >
                              {f.value || 'Not Available'}
                            </span>
                            {!isNA && (
                              <button
                                onClick={() => handleCopyFieldValue(f.value, rowKey)}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity shrink-0"
                                title="Copy value"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
