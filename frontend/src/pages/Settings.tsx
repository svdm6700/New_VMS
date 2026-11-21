import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Sliders,
  Languages,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { documentService } from '../services/documentService';
import { API_BASE_URL } from '../services/api';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { backendOnline } = useDocuments();

  const [testingHealth, setTestingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<{ status: string; timestamp?: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [defaultZoom, setDefaultZoom] = useState('100');
  const [defaultLang, setDefaultLang] = useState('tel+eng');

  const handleTestConnection = async () => {
    setTestingHealth(true);
    setHealthError(null);
    try {
      const res = await documentService.checkHealth();
      setHealthResult(res);
    } catch (err: any) {
      setHealthError(err.message || 'Connection failed.');
    } finally {
      setTestingHealth(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brand-600" />
          Application Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure appearance, backend connection, reader preferences, and OCR defaults.
        </p>
      </div>

      {/* Theme Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Appearance & Theme</h3>
          <p className="text-xs text-slate-400">Choose your preferred dashboard interface style</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${
              theme === 'light'
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500" />
            <span>Light Mode</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${
              theme === 'dark'
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-400" />
            <span>Dark Mode</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${
              theme === 'system'
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Monitor className="w-5 h-5 text-slate-400" />
            <span>System Default</span>
          </button>
        </div>
      </div>

      {/* Backend API Configuration */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">FastAPI Backend Connection</h3>
            <p className="text-xs text-slate-400">Endpoint URL configured via frontend `.env`</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              backendOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {backendOnline ? 'Operational' : 'Disconnected'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300">
          Base URL: <span className="font-bold text-brand-600 dark:text-brand-400">{API_BASE_URL}</span>
        </div>

        <div>
          <button
            type="button"
            disabled={testingHealth}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingHealth ? 'animate-spin' : ''}`} />
            <span>Test Connection Health</span>
          </button>
        </div>

        {healthResult && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Server responded with status: "{healthResult.status}" ({healthResult.timestamp || 'OK'})</span>
          </div>
        )}

        {healthError && (
          <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{healthError}</span>
          </div>
        )}
      </div>

      {/* Reader & Processing Preferences */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reader Preferences</h3>
          <p className="text-xs text-slate-400">Default settings for document viewing</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Default PDF Zoom
            </label>
            <select
              value={defaultZoom}
              onChange={(e) => setDefaultZoom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            >
              <option value="75">75%</option>
              <option value="100">100% (Fit width)</option>
              <option value="125">125%</option>
              <option value="150">150%</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Default OCR Engine Target
            </label>
            <select
              value={defaultLang}
              onChange={(e) => setDefaultLang(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            >
              <option value="tel+eng">Telugu + English (tel+eng)</option>
              <option value="tel">Telugu only (tel)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Application Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-slate-100">About Telugu PDF Reader Pro</h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Version 1.2.0 • React 18, TypeScript, Tailwind CSS, Python FastAPI, PyMuPDF, pdfplumber, Tesseract OCR, and Ollama LLM.
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              Engineered for seamless extraction of Telugu Unicode scripts and complex tabular layouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
