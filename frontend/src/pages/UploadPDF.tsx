import React, { useState } from 'react';
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
  Hash
} from 'lucide-react';
import { FileUpload } from '../components/upload/FileUpload';
import { UploadProgress } from '../components/upload/UploadProgress';
import { documentService } from '../services/documentService';
import { useDocuments } from '../contexts/DocumentContext';

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

  // Touched state for field-specific error display
  const [touched, setTouched] = useState({
    district: false,
    constituency: false,
    area: false,
    wardNumber: false,
  });

  // Pipeline & AI Translation settings
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('llama3.2');
  const [useAi, setUseAi] = useState(false);

  // Processing & Feedback states
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processStage, setProcessStage] = useState('Preparing upload...');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Field validation checks
  const isDistrictValid = district.trim().length > 0;
  const isConstituencyValid = constituency.trim().length > 0;
  const isAreaValid = area.trim().length > 0;
  const isWardValid = wardNumber.trim().length > 0;
  const isFileValid = file !== null;

  const isFormValid = isFileValid && isDistrictValid && isConstituencyValid && isAreaValid && isWardValid;

  const handleStartProcess = async () => {
    // Mark all fields touched
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
    setSuccess(null);
    setProcessStage('Uploading PDF document and location metadata to server...');

    try {
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
            setProcessStage('PDF & location metadata uploaded! Automatically extracting voter records & storing in database...');
          }
        },
      });

      const docId = uploadRes.id;
      let attempts = 0;
      const maxAttempts = 120; // 3 minutes timeout for huge files
      let completedDoc: any = null;

      // Poll until backend completes extraction
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        attempts++;
        try {
          const docData = await documentService.getDocument(docId);
          const st = docData.metadata?.processing_status;

          if (st === 'completed') {
            completedDoc = docData;
            break;
          } else if (st === 'failed') {
            throw new Error(docData.metadata?.processing_error || 'Automatic extraction failed on server.');
          } else {
            setProcessStage(`Extracting Telugu text & voter records... (${attempts * 2}s)`);
          }
        } catch (e: any) {
          if (e.message?.includes('failed on server')) {
            throw e;
          }
        }
      }

      await refreshDocuments();

      if (completedDoc) {
        setActiveDoc(completedDoc);
        const count = completedDoc.metadata?.records_count || completedDoc.records?.length || 0;
        setSuccess(`"${file.name}" processed successfully! ${count.toLocaleString()} voter records linked to ${area.trim()} (Ward ${wardNumber.trim()}).`);
      } else {
        setSuccess(`"${file.name}" uploaded successfully with location details and processing in background!`);
      }

      setTimeout(() => {
        navigate('/extracted-data');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Processing failed. Please check the server connection.');
    } finally {
      setIsProcessing(false);
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
          Upload any voter document or electoral roll up to 300 MB with location details. All voter records are automatically extracted and stored in the PostgreSQL database.
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

        {/* Processing Progress */}
        {isProcessing && file && (
          <UploadProgress
            progress={uploadProgress}
            stage={processStage}
            filename={file.name}
            onCancel={() => setIsProcessing(false)}
          />
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
                  Enter manual jurisdiction and area details to link with voter records (All fields required *)
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
              Required *
            </span>
          </div>

          {/* Datalists for quick suggestions while allowing full manual typing */}
          <datalist id="district-suggestions">
            <option value="West Godavari (పశ్చిమ గోదావరి)" />
            <option value="East Godavari (తూర్పు గోదావరి)" />
            <option value="Krishna (కృష్ణా)" />
            <option value="Guntur (గుంటూరు)" />
            <option value="Visakhapatnam (విశాఖపట్నం)" />
            <option value="Kurnool (కర్నూలు)" />
            <option value="Anantapur (అనంతపురం)" />
            <option value="Chittoor (చిత్తూరు)" />
            <option value="YSR Kadapa (వైఎస్సార్ కడప)" />
            <option value="Nellore (నెల్లూరు)" />
            <option value="Prakasam (ప్రకాశం)" />
            <option value="Srikakulam (శ్రీకాకుళం)" />
            <option value="Vizianagaram (విజయనగరం)" />
            <option value="Hyderabad (హైదరాబాద్)" />
            <option value="Rangareddy (రంగారెడ్డి)" />
            <option value="Warangal (వరంగల్)" />
          </datalist>

          <datalist id="constituency-suggestions">
            <option value="Tadepalligudem (తాడేపల్లిగూడెం)" />
            <option value="Bhimavaram (భీమవరం)" />
            <option value="Tanuku (తణుకు)" />
            <option value="Eluru (ఏలూరు)" />
            <option value="Narasapuram (నరసాపురం)" />
            <option value="Palakollu (పాలకొల్లు)" />
            <option value="Unguturu (ఉంగుటూరు)" />
            <option value="Kovvur (కొవ్వూరు)" />
            <option value="Achanta (ఆచంట)" />
            <option value="Rajahmundry City (రాజమండ్రి సిటీ)" />
            <option value="Vijayawada Central (విజయవాడ సెంట్రల్)" />
            <option value="Guntur West (గుంటూరు పశ్చిమ)" />
          </datalist>

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
                  list="district-suggestions"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (!touched.district) setTouched((t) => ({ ...t, district: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, district: true }))}
                  placeholder="Select or enter district (జిల్లా)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.district && !isDistrictValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
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
                  list="constituency-suggestions"
                  value={constituency}
                  onChange={(e) => {
                    setConstituency(e.target.value);
                    if (!touched.constituency) setTouched((t) => ({ ...t, constituency: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, constituency: true }))}
                  placeholder="Enter constituency name (నియోజకవర్గం)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.constituency && !isConstituencyValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
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
                  value={wardNumber}
                  onChange={(e) => {
                    setWardNumber(e.target.value);
                    if (!touched.wardNumber) setTouched((t) => ({ ...t, wardNumber: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, wardNumber: true }))}
                  placeholder="Enter ward number (వార్డు నంబర్)"
                  className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    touched.wardNumber && !isWardValid
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
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
                  placeholder="http://localhost:11434"
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
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success} Redirecting to Extracted Data Table...</span>
          </div>
        )}
      </div>
    </div>
  );
};
