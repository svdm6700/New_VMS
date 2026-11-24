import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  ChevronDown,
  Search,
  X
} from 'lucide-react';
import { FileUpload } from '../components/upload/FileUpload';
import { UploadProgress } from '../components/upload/UploadProgress';
import { documentService } from '../services/documentService';
import { useDocuments } from '../contexts/DocumentContext';
import { geoService, District, Constituency, Ward } from '../services/geoService';
import { useAuth } from '../contexts/AuthContext';
import { DocumentProgress as IDocumentProgress, DocumentPageItem } from '../types/document';
import { logger } from '../services/loggingService';

// ---------------------------------------------------------------------------
// Searchable Dropdown Option Interface
// ---------------------------------------------------------------------------
interface DropdownOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  raw?: any;
}

interface SearchableDropdownProps {
  id: string;
  label: string;
  teluguLabel?: string;
  icon?: React.ReactNode;
  placeholder: string;
  options: DropdownOption[];
  selectedValue: string | number | '';
  selectedLabel?: string;
  onSelect: (option: DropdownOption | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  required?: boolean;
  error?: string | null;
  allowCustomInput?: boolean;
  emptyMessage?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  id,
  label,
  teluguLabel,
  icon,
  placeholder,
  options,
  selectedValue,
  selectedLabel,
  onSelect,
  isLoading = false,
  disabled = false,
  disabledReason,
  required = false,
  error = null,
  allowCustomInput = false,
  emptyMessage = 'No options available',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const matchLabel = opt.label.toLowerCase().includes(q);
    const matchSublabel = opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false;
    const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false;
    return matchLabel || matchSublabel || matchBadge;
  });

  const displaySelected = selectedLabel || options.find((o) => o.value === selectedValue)?.label || '';

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  const handleCustomSubmit = () => {
    const clean = searchTerm.trim();
    if (clean) {
      onSelect({
        value: clean,
        label: clean,
        sublabel: 'Custom entered',
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span>{label}</span>
          {teluguLabel && <span className="text-slate-400 font-telugu">({teluguLabel})</span>}
          {required && <span className="text-rose-500">*</span>}
        </span>
        {isLoading && (
          <span className="flex items-center gap-1 text-[10px] text-brand-600 dark:text-brand-400 font-medium">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Loading...
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 text-xs text-left bg-slate-50 dark:bg-slate-800 border rounded-xl flex items-center justify-between transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400'
            : error
            ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
            : isOpen
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <span className={`truncate ${displaySelected ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400'}`}>
          {displaySelected || (disabled && disabledReason ? disabledReason : placeholder)}
        </span>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {displaySelected && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Error message */}
      {error && (
        <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Popover Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search / వెతకండి..."
              className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-100/50 dark:divide-slate-800/50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === selectedValue || opt.label === displaySelected;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onSelect(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="truncate font-medium">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-4 px-3 text-center text-xs text-slate-400">
                <p>{emptyMessage}</p>
                {allowCustomInput && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-lg transition-colors border border-brand-200 dark:border-brand-800"
                  >
                    <span>Use &ldquo;{searchTerm.trim()}&rdquo;</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const UploadPDF: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveDoc, refreshDocuments } = useDocuments();

  // Document state
  const [file, setFile] = useState<File | null>(null);

  // Cascading Location Hierarchy State
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | ''>('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<number | ''>('');
  const [selectedConstituencyName, setSelectedConstituencyName] = useState('');
  const [loadingConstituencies, setLoadingConstituencies] = useState(false);

  const [areas, setAreas] = useState<{ name: string }[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<number | ''>('');
  const [selectedWardNumber, setSelectedWardNumber] = useState('');
  const [loadingWards, setLoadingWards] = useState(false);

  // Touched state for field-specific error display
  const [touched, setTouched] = useState({
    district: false,
    constituency: false,
    area: false,
    wardNumber: false,
  });

  // 1. Initial Load: Fetch all available Districts from Geographic Management
  useEffect(() => {
    let isMounted = true;
    setLoadingDistricts(true);
    geoService.getCascadingDistricts()
      .then((data) => {
        if (!isMounted) return;
        setDistricts(data || []);
        if (data && data.length === 1) {
          setSelectedDistrictId(data[0].id);
          setSelectedDistrictName(data[0].name);
        }
      })
      .catch((e) => console.warn('Could not fetch districts:', e))
      .finally(() => {
        if (isMounted) setLoadingDistricts(false);
      });
    return () => { isMounted = false; };
  }, []);

  // 2. Cascade 1: When District changes, fetch Constituencies belonging to that District
  useEffect(() => {
    if (!selectedDistrictId) {
      setConstituencies([]);
      setSelectedConstituencyId('');
      setSelectedConstituencyName('');
      setAreas([]);
      setSelectedArea('');
      setWards([]);
      setSelectedWardId('');
      setSelectedWardNumber('');
      return;
    }

    let isMounted = true;
    setLoadingConstituencies(true);
    setSelectedConstituencyId('');
    setSelectedConstituencyName('');
    setAreas([]);
    setSelectedArea('');
    setWards([]);
    setSelectedWardId('');
    setSelectedWardNumber('');

    geoService.getCascadingConstituencies(Number(selectedDistrictId), selectedDistrictName)
      .then((data) => {
        if (!isMounted) return;
        setConstituencies(data || []);
        if (data && data.length === 1) {
          setSelectedConstituencyId(data[0].id);
          setSelectedConstituencyName(data[0].name);
        }
      })
      .catch((e) => console.warn('Could not fetch constituencies:', e))
      .finally(() => {
        if (isMounted) setLoadingConstituencies(false);
      });
    return () => { isMounted = false; };
  }, [selectedDistrictId]);

  // 3. Cascade 2: When Constituency changes, fetch Areas/Villages belonging to that Constituency
  useEffect(() => {
    if (!selectedConstituencyId) {
      setAreas([]);
      setSelectedArea('');
      setWards([]);
      setSelectedWardId('');
      setSelectedWardNumber('');
      return;
    }

    let isMounted = true;
    setLoadingAreas(true);
    setSelectedArea('');
    setWards([]);
    setSelectedWardId('');
    setSelectedWardNumber('');

    geoService.getCascadingAreas(Number(selectedConstituencyId), selectedConstituencyName)
      .then((data) => {
        if (!isMounted) return;
        setAreas(data || []);
        if (data && data.length === 1) {
          setSelectedArea(data[0].name);
        }
      })
      .catch((e) => console.warn('Could not fetch areas:', e))
      .finally(() => {
        if (isMounted) setLoadingAreas(false);
      });
    return () => { isMounted = false; };
  }, [selectedConstituencyId]);

  // 4. Cascade 3: When Area changes, fetch Wards associated with that Area & Constituency
  useEffect(() => {
    if (!selectedConstituencyId) {
      setWards([]);
      setSelectedWardId('');
      setSelectedWardNumber('');
      return;
    }

    let isMounted = true;
    setLoadingWards(true);
    setSelectedWardId('');
    setSelectedWardNumber('');

    geoService.getCascadingWards(Number(selectedConstituencyId), selectedArea)
      .then((data) => {
        if (!isMounted) return;
        setWards(data || []);
        if (data && data.length === 1) {
          setSelectedWardId(data[0].id);
          setSelectedWardNumber(data[0].ward_number);
        }
      })
      .catch((e) => console.warn('Could not fetch wards:', e))
      .finally(() => {
        if (isMounted) setLoadingWards(false);
      });
    return () => { isMounted = false; };
  }, [selectedConstituencyId, selectedArea]);

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
  const isDistrictValid = Boolean(selectedDistrictId || selectedDistrictName.trim());
  const isConstituencyValid = Boolean(selectedConstituencyId || selectedConstituencyName.trim());
  const isAreaValid = selectedArea.trim().length > 0;
  const isWardValid = Boolean(selectedWardId || selectedWardNumber.trim());
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
      setError('Please select all required geographic details (District, Constituency, Area, Ward) and a PDF document.');
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
      logger.info('Starting document upload with geographic details', {
        filename: file.name,
        size: file.size,
        district_id: selectedDistrictId,
        district: selectedDistrictName,
        constituency_id: selectedConstituencyId,
        constituency: selectedConstituencyName,
        area: selectedArea,
        ward_id: selectedWardId,
        ward: selectedWardNumber
      });
      
      const uploadRes = await documentService.uploadPdf(file, {
        district: selectedDistrictName.trim(),
        district_id: selectedDistrictId ? Number(selectedDistrictId) : undefined,
        constituency: selectedConstituencyName.trim(),
        constituency_id: selectedConstituencyId ? Number(selectedConstituencyId) : undefined,
        area: selectedArea.trim(),
        ward_number: selectedWardNumber.trim(),
        ward_id: selectedWardId ? Number(selectedWardId) : undefined,
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
          `"${file.name}" processed! ${count.toLocaleString()} voter records linked to ${selectedArea.trim()} (Ward ${selectedWardNumber.trim()}).`
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

  // Convert models to DropdownOptions
  const districtOptions: DropdownOption[] = districts.map((d) => ({
    value: d.id,
    label: d.name,
    sublabel: d.code ? `Code: ${d.code}` : undefined,
    badge: d.state ? d.state : undefined,
    raw: d,
  }));

  const constituencyOptions: DropdownOption[] = constituencies.map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.code ? `Code: ${c.code}` : undefined,
    badge: c.wards_count ? `${c.wards_count} Wards` : undefined,
    raw: c,
  }));

  const areaOptions: DropdownOption[] = areas.map((a) => ({
    value: a.name,
    label: a.name,
    raw: a,
  }));

  const wardOptions: DropdownOption[] = wards.map((w) => ({
    value: w.id,
    label: `Ward ${w.ward_number} (వార్డు ${w.ward_number})`,
    sublabel: w.area_name ? `Area: ${w.area_name}` : undefined,
    badge: `#${w.ward_number}`,
    raw: w,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-telugu">
          ఓటర్ డాక్యుమెంట్ అప్‌లోడ్ & వెలికితీత (Upload Voter Document)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Upload any voter document or electoral roll up to 300 MB. Select geographic details through dynamic dependent dropdowns. Pages are extracted independently and asynchronously in the background.
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
        {/* Document Details: Geographic Dropdowns (ప్రాంత వివరాలు) */}
        {/* ========================================================= */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Document Details – Geographic Dropdowns (ప్రాంత వివరాలు)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Select District &rarr; Constituency &rarr; Area &rarr; Ward to link records accurately. All dropdown values are fetched live from Geographic Management.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
              Required *
            </span>
          </div>

          {/* 2-Column Responsive Dependent Dropdowns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* 1. District (జిల్లా) */}
            <SearchableDropdown
              id="geo-district-dropdown"
              label="District"
              teluguLabel="జిల్లా"
              icon={<Landmark className="w-3.5 h-3.5" />}
              placeholder="Select District (జిల్లా ఎంచుకోండి)"
              options={districtOptions}
              selectedValue={selectedDistrictId}
              selectedLabel={selectedDistrictName}
              isLoading={loadingDistricts}
              required={true}
              error={touched.district && !isDistrictValid ? 'District is required.' : null}
              emptyMessage="No districts found in Geographic Management."
              onSelect={(opt) => {
                if (opt) {
                  setSelectedDistrictId(Number(opt.value));
                  setSelectedDistrictName(opt.label);
                } else {
                  setSelectedDistrictId('');
                  setSelectedDistrictName('');
                }
                setTouched((t) => ({ ...t, district: true }));
              }}
            />

            {/* 2. Constituency (నియోజకవర్గం) */}
            <SearchableDropdown
              id="geo-constituency-dropdown"
              label="Constituency"
              teluguLabel="నియోజకవర్గం"
              icon={<Building2 className="w-3.5 h-3.5" />}
              placeholder="Select Constituency (నియోజకవర్గం ఎంచుకోండి)"
              options={constituencyOptions}
              selectedValue={selectedConstituencyId}
              selectedLabel={selectedConstituencyName}
              isLoading={loadingConstituencies}
              disabled={!selectedDistrictId}
              disabledReason="Select District first"
              required={true}
              error={touched.constituency && !isConstituencyValid ? 'Constituency is required.' : null}
              emptyMessage={selectedDistrictId ? 'No constituencies found for this district.' : 'Select District first.'}
              onSelect={(opt) => {
                if (opt) {
                  setSelectedConstituencyId(Number(opt.value));
                  setSelectedConstituencyName(opt.label);
                } else {
                  setSelectedConstituencyId('');
                  setSelectedConstituencyName('');
                }
                setTouched((t) => ({ ...t, constituency: true }));
              }}
            />

            {/* 3. Area / Village (ప్రాంతం / గ్రామం) */}
            <SearchableDropdown
              id="geo-area-dropdown"
              label="Area / Village"
              teluguLabel="ప్రాంతం / గ్రామం"
              icon={<Home className="w-3.5 h-3.5" />}
              placeholder="Select or enter Area/Village (ప్రాంతం ఎంచుకోండి)"
              options={areaOptions}
              selectedValue={selectedArea}
              selectedLabel={selectedArea}
              isLoading={loadingAreas}
              disabled={!selectedConstituencyId}
              disabledReason="Select Constituency first"
              required={true}
              allowCustomInput={true}
              error={touched.area && !isAreaValid ? 'Area / Village is required.' : null}
              emptyMessage={selectedConstituencyId ? 'No areas registered. Type name to add custom.' : 'Select Constituency first.'}
              onSelect={(opt) => {
                if (opt) {
                  setSelectedArea(opt.label);
                } else {
                  setSelectedArea('');
                }
                setTouched((t) => ({ ...t, area: true }));
              }}
            />

            {/* 4. Ward Number (వార్డు నంబర్) */}
            <SearchableDropdown
              id="geo-ward-dropdown"
              label="Ward Number"
              teluguLabel="వార్డు నంబర్"
              icon={<Hash className="w-3.5 h-3.5" />}
              placeholder="Select Ward Number (వార్డు ఎంచుకోండి)"
              options={wardOptions}
              selectedValue={selectedWardId}
              selectedLabel={selectedWardNumber ? `Ward ${selectedWardNumber}` : ''}
              isLoading={loadingWards}
              disabled={!selectedConstituencyId}
              disabledReason="Select Constituency first"
              required={true}
              allowCustomInput={true}
              error={touched.wardNumber && !isWardValid ? 'Ward number is required.' : null}
              emptyMessage={selectedConstituencyId ? 'No wards registered for this area. Type number to add.' : 'Select Constituency first.'}
              onSelect={(opt) => {
                if (opt) {
                  if (typeof opt.value === 'number') {
                    setSelectedWardId(opt.value);
                    const rawWard = opt.raw as Ward | undefined;
                    setSelectedWardNumber(rawWard?.ward_number || String(opt.label).replace(/^Ward\s*/i, ''));
                  } else {
                    setSelectedWardId('');
                    setSelectedWardNumber(String(opt.value).replace(/^Ward\s*/i, ''));
                  }
                } else {
                  setSelectedWardId('');
                  setSelectedWardNumber('');
                }
                setTouched((t) => ({ ...t, wardNumber: true }));
              }}
            />
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
                : 'Please select all required geographic dropdowns (District, Constituency, Area, Ward) to enable upload.'}
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

