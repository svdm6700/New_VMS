import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSearch,
  Sparkles,
  Bot,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  MapPin,
  Building2,
  Landmark,
  Home,
  Hash,
  Layers,
  FileText,
  RotateCcw,
  Check,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { FileUpload } from '../components/upload/FileUpload';
import { UploadProgress } from '../components/upload/UploadProgress';
import { documentService } from '../services/documentService';
import { useDocuments } from '../contexts/DocumentContext';
import { geoService } from '../services/geoService';
import { useAuth } from '../contexts/AuthContext';
import { DocumentProgress as IDocumentProgress, DocumentPageItem } from '../types/document';
import { logger } from '../services/loggingService';

export const UploadPDF: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveDoc, refreshDocuments } = useDocuments();

  // Document state
  const [file, setFile] = useState<File | null>(null);

  // Manual Location Details (Required)
  const [district, setDistrict] = useState('');
  const [constituency, setConstituency] = useState('');
  const [area, setArea] = useState('');
  const [wardNumber, setWardNumber] = useState('');

  const [availableLocations, setAvailableLocations] = useState<{
    districts: string[];
    constituencies: string[];
    wards: string[];
  }>({
    districts: [],
    constituencies: [],
    wards: [],
  });

  useEffect(() => {
    geoService.getLocations().then((locs) => {
      setAvailableLocations(locs);
      if (locs.districts.length === 1 && !district) {
        setDistrict(locs.districts[0]);
      }
      if (locs.constituencies.length === 1 && !constituency) {
        setConstituency(locs.constituencies[0]);
      }
      if (locs.wards.length === 1 && !wardNumber) {
        setWardNumber(locs.wards[0]);
      }
    }).catch((e) => console.warn('Could not fetch locations:', e));
  }, []);

  // Touched state for field-specific error display
  const [touched, setTouched] = useState({
    district: false,
    constituency: false,
    area: false,
    wardNumber: false,
  });

  // Pipeline & AI Translation settings
  const defaultOllama = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OLLAMA_URL) || '';
  const defaultModel = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OLLAMA_MODEL) || 'llama3.2';
  const [ollamaUrl, setOllamaUrl] = useState(defaultOllama);
  const [modelName, setModelName] = useState(defaultModel);
  const [useAi, setUseAi] = useState(false);

  // Processing & Page-wise Feedback states
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processStage, setProcessStage] = useState('Preparing upload...');
  const [progressData, setProgressData] = useState<IDocumentProgress | null>(null);
  const [retryingPage, setRetryingPage] = useState<number | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateDocId, setDuplicateDocId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Field validation checks
  const isDistrictValid = district.trim().length > 0;
  const isConstituencyValid = constituency.trim().length > 0;
  const isAreaValid = area.trim().length > 0;
  const isWardValid = wardNumber.trim().length > 0;
  const isFileValid = file !== null;

  const isFormValid = isFileValid && isDistrictValid && isConstituencyValid && isAreaValid && isWardValid;

  const handleStartProcess = async () => {
    setTouched({
      district: true,
      constituency: true,
      area: true,
      wardNumber: true,
    });

    if (!isFormValid || !file) {
      setError('Please fill in all required location details and select a PDF document.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setError(null);
    setDuplicateDocId(null);
    setSuccess(null);
    setProgressData(null);
    setProcessStage('Uploading original PDF document and location metadata to server...');

    try {
      logger.info('Starting document upload', { filename: file.name, size: file.size, district, constituency, ward: wardNumber });
      
      const uploadRes = await documentService.uploadPdf(file, {
        district: district.trim(),
        constituency: constituency.trim(),
        area: area.trim(),
        ward_number: wardNumber.trim(),
        ollamaUrl,
        modelName,
        useAi,
        onUploadProgress: (p) => {
          setUploadProgress(p);
          if (p === 100) {
            setProcessStage('PDF uploaded successfully! Starting background page-wise extraction...');
          }
        },
      });

      const docId = uploadRes.id;
      setActiveDocId(docId);
      logger.info('Document uploaded, tracking page-wise progress', { docId });

      let attempts = 0;
      const maxAttempts = 360; // 12 minutes timeout for large bulk files
      let completedDoc: any = null;

      // Real-time Page-Wise Polling
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        try {
          const prog = await documentService.getDocumentProgress(docId);
          setProgressData(prog);
          setUploadProgress(prog.progress_percentage || 0);

          const total = prog.total_pages || 1;
          const done = prog.processed_pages || 0;
          const voters = prog.total_voters || 0;
          const failed = prog.failed_pages || 0;

          if (prog.status === 'completed') {
            setProcessStage(`Completed! All ${total} pages extracted (${voters.toLocaleString()} voters stored in database).`);
            completedDoc = await documentService.getDocument(docId);
            break;
          } else if (prog.status === 'completed_with_errors') {
            setProcessStage(`Extraction completed with warnings: ${done} pages succeeded, ${failed} failed.`);
            completedDoc = await documentService.getDocument(docId);
            break;
          } else if (prog.status === 'failed') {
            throw new Error('Automatic extraction pipeline reported failure.');
          } else {
            const failText = failed > 0 ? ` [${failed} failed]` : '';
            setProcessStage(
              `Processing page ${done} of ${total} (${voters.toLocaleString()} voters extracted so far)...${failText}`
            );
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes('reported failure')) {
            throw pollErr;
          }
          console.warn('Progress poll issue:', pollErr);
        }
      }

      await refreshDocuments();

      if (completedDoc) {
        setActiveDoc(completedDoc);
        const count = completedDoc.metadata?.records_count || completedDoc.records?.length || 0;
        setSuccess(
          `"${file.name}" processed! ${count.toLocaleString()} voter records linked to ${area.trim()} (Ward ${wardNumber.trim()}).`
        );
      } else {
        setSuccess(`"${file.name}" uploaded successfully with location details and processing in background!`);
      }
    } catch (err: any) {
      logger.error('Document processing failed', { error: err.message });
      const dupId = err.response?.data?.detail?.existing_document?.id || 
                    (typeof err.message === 'string' && err.message.match(/ID:\s*([a-f0-9-]+)/i)?.[1]);
      if (dupId) {
        setDuplicateDocId(dupId);
      }
      setError(err.message || 'Processing failed. Please check the server connection.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetrySinglePage = async (pageNo: number) => {
    if (!activeDocId) return;
    try {
      setRetryingPage(pageNo);
      logger.info('Retrying individual page', { docId: activeDocId, pageNo });
      await documentService.retryPage(activeDocId, pageNo);
      const updated = await documentService.getDocumentProgress(activeDocId);
      setProgressData(updated);
    } catch (err: any) {
      logger.error('Failed to retry page', { docId: activeDocId, pageNo, error: err.message });
      setError(`Failed to retry page ${pageNo}: ${err.message}`);
    } finally {
      setRetryingPage(null);
    }
  };

  const handleRetryAllFailed = async () => {
    if (!activeDocId) return;
    try {
      setIsRetryingAll(true);
      logger.info('Retrying all failed pages', { docId: activeDocId });
      await documentService.retryFailedPages(activeDocId);
      const updated = await documentService.getDocumentProgress(activeDocId);
      setProgressData(updated);
    } catch (err: any) {
      logger.error('Failed to retry failed pages', { docId: activeDocId, error: err.message });
      setError(`Failed to retry pages: ${err.message}`);
    } finally {
      setIsRetryingAll(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-telugu">
          ఓటర్ డాక్యుమెంట్ అప్‌లోడ్ & వెలికితీత (Upload Voter Document)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Upload any voter document or electoral roll up to 300 MB. Pages are extracted independently and asynchronously in the background. Completed pages and records become available immediately.
        </p>
      </div>

      {/* Upload Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Select Document</h3>
          <p className="text-xs text-slate-400">PDF files up to 300 MB supported (Scanned & Digital text)</p>
        </div>

        {/* File Dropzone */}
        <FileUpload file={file} onFileSelect={setFile} maxSizeMb={300} />

        {/* Live Page-Wise Extraction Progress */}
        {isProcessing && file && (
          <div className="space-y-4">
            <UploadProgress
              progress={uploadProgress}
              stage={processStage}
              filename={file.name}
              onCancel={() => setIsProcessing(false)}
            />

            {progressData && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Layers className="w-4 h-4 text-brand-600" />
                    Page-Wise Background Extraction
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {progressData.processed_pages} Done
                    </span>
                    {progressData.failed_pages > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {progressData.failed_pages} Failed
                      </span>
                    )}
                    <span className="text-brand-600 dark:text-brand-400 font-bold">
                      {progressData.total_voters.toLocaleString()} Voters Extracted
                    </span>
                  </div>
                </div>

                {/* Individual Page Status Badges */}
                <div className="max-h-40 overflow-y-auto pr-1">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 text-[10px]">
                    {progressData.pages?.map((p) => {
                      const isDone = p.status === 'completed';
                      const isFail = p.status === 'failed';
                      const isProc = p.status === 'processing';
                      const isRetrying = retryingPage === p.page_number;

                      return (
                        <div
                          key={p.page_number}
                          title={isFail ? `Error: ${p.error_details || 'Failed'}` : `Page ${p.page_number}: ${p.voter_count} voters`}
                          className={`p-1.5 rounded-lg border text-center transition-all relative group ${
                            isDone
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                              : isFail
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                              : isProc
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-center gap-0.5">
                            {isDone && <Check className="w-2.5 h-2.5" />}
                            {isFail && <AlertTriangle className="w-2.5 h-2.5" />}
                            {isProc && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                            <span>p.{p.page_number}</span>
                          </div>
                          <div className="text-[9px] truncate">
                            {isDone ? `${p.voter_count}v` : p.status}
                          </div>

                          {/* Hover retry button for failed page */}
                          {isFail && (
                            <button
                              type="button"
                              onClick={() => handleRetrySinglePage(p.page_number)}
                              disabled={isRetrying}
                              className="absolute inset-0 bg-rose-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <RotateCcw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Failed Pages Retry Banner */}
                {progressData.failed_pages > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {progressData.failed_pages} page(s) encountered issues during extraction.
                    </span>
                    <button
                      type="button"
                      onClick={handleRetryAllFailed}
                      disabled={isRetryingAll}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <RotateCcw className={`w-3 h-3 ${isRetryingAll ? 'animate-spin' : ''}`} />
                      Retry All Failed
                    </button>
                  </div>
                )}

                {/* Continue in background button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/extracted-data')}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View Extracted Records Table while processing...</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* Document Location Details (ప్రాంత వివరాలు) */}
        {/* ========================================================= */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Document Location Details (ప్రాంత వివరాలు)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Enter manual district, constituency, area and ward details to link with voter records (All fields required *)
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
              Required *
            </span>
          </div>

          {/* 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Field 1: District (జిల్లా) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>District (జిల్లా) <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="districts-list"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (!touched.district) setTouched((t) => ({ ...t, district: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, district: true }))}
                  placeholder="Enter or select district name (జిల్లా)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.district && !isDistrictValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
                <datalist id="districts-list">
                  {availableLocations.districts.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              {touched.district && !isDistrictValid && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>District name is required.</span>
                </p>
              )}
            </div>

            {/* Field 2: Constituency (నియోజకవర్గం) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Constituency (నియోజకవర్గం) <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="constituencies-list"
                  value={constituency}
                  onChange={(e) => {
                    setConstituency(e.target.value);
                    if (!touched.constituency) setTouched((t) => ({ ...t, constituency: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, constituency: true }))}
                  placeholder="Enter or select constituency (నియోజకవర్గం)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.constituency && !isConstituencyValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
                <datalist id="constituencies-list">
                  {availableLocations.constituencies.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              {touched.constituency && !isConstituencyValid && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Constituency name is required.</span>
                </p>
              )}
            </div>

            {/* Field 3: Area / Village (ప్రాంతం / గ్రామం) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Area / Village (ప్రాంతం / గ్రామం) <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    if (!touched.area) setTouched((t) => ({ ...t, area: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, area: true }))}
                  placeholder="Enter area / village name (ప్రాంతం / గ్రామం)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.area && !isAreaValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
              </div>
              {touched.area && !isAreaValid && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Area or village name is required.</span>
                </p>
              )}
            </div>

            {/* Field 4: Ward Number (వార్డు నంబర్) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Ward Number (వార్డు నంబర్) <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="wards-list"
                  value={wardNumber}
                  onChange={(e) => {
                    setWardNumber(e.target.value);
                    if (!touched.wardNumber) setTouched((t) => ({ ...t, wardNumber: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, wardNumber: true }))}
                  placeholder="Enter or select ward number (వార్డు నంబర్)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.wardNumber && !isWardValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
                <datalist id="wards-list">
                  {availableLocations.wards.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>
              {touched.wardNumber && !isWardValid && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Ward number is required.</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI & Pipeline Settings (Optional) */}
        <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Pipeline & Translation Settings (Optional)
            </h4>
          </div>

          <label className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-brand-600" />
                Enable Ollama AI Paragraph Translation
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                (Optional) Translates paragraphs into English using local Ollama. When unchecked, full Telugu text, voter records, and tables are extracted immediately at top speed.
              </p>
            </div>
          </label>

          {useAi && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ollama Endpoint URL
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder={defaultOllama || "e.g. http://localhost:11434"}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  AI Model
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="llama3.2"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            disabled={!isFormValid || isProcessing}
            onClick={handleStartProcess}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing & Storing in Database...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4" />
                <span>Upload & Start Automatic Extraction</span>
              </>
            )}
          </button>
          {!isFormValid && (
            <p className="text-[11px] text-slate-400 text-center mt-2">
              {!file
                ? 'Please select a PDF file and complete location details above to proceed.'
                : 'Please complete all required location fields (District, Constituency, Area, Ward) to enable upload.'}
            </p>
          )}
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="flex flex-col gap-2 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium break-words leading-relaxed">{error}</span>
            </div>
            {duplicateDocId && (
              <div className="pl-6.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/data?docId=${duplicateDocId}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <span>View Existing Document</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>
    </div>
  );
};
