import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertOctagon,
  UploadCloud,
  Layers,
  Sparkles,
  ArrowRight,
  TableProperties,
} from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentDocuments } from '../components/dashboard/RecentDocuments';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { documents, isLoading, loadDocument } = useDocuments();

  const total = documents.length;
  const processed = documents.filter((d) => d.status === 'completed').length;
  const pending = documents.filter((d) => d.status === 'processing' || d.status === 'pending' || d.status === 'uploaded').length;
  const failed = documents.filter((d) => d.status === 'failed').length;
  const totalRecords = documents.reduce((acc, d) => acc + (d.records_count || 0), 0);

  const handleSelectDoc = async (id: string) => {
    await loadDocument(id);
    navigate('/extracted-data');
  };

  if (isLoading && !documents.length) {
    return <LoadingSpinner label="Loading dashboard metrics..." size="lg" className="min-h-[60vh]" />;
  }

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            VMS - Smart Voter AI Suite
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
            VMS – Voter Management System
          </h1>
          <p className="text-xs sm:text-sm text-brand-100/90 leading-relaxed mb-5">
            Automatic Telugu electoral roll extraction, PostgreSQL database storage, and 10-column structured analysis for files up to 300 MB.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/upload')}
              className="px-4 py-2 bg-white text-brand-700 hover:bg-brand-50 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Voter Document
            </button>
            <button
              onClick={() => navigate('/extracted-data')}
              className="px-4 py-2 bg-brand-800/60 hover:bg-brand-800/80 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5"
            >
              <TableProperties className="w-3.5 h-3.5" />
              View Voter Records ({totalRecords.toLocaleString()})
            </button>
          </div>
        </div>
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Total Documents"
          value={total}
          sublabel="Stored in database"
          icon={Layers}
          variant="brand"
        />
        <StatCard
          label="Extracted Records"
          value={totalRecords}
          sublabel="Voters in database"
          icon={TableProperties}
          variant="brand"
        />
        <StatCard
          label="Processed"
          value={processed}
          sublabel="Successfully completed"
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          label="Processing Queue"
          value={pending}
          sublabel="Currently extracting"
          icon={Clock}
          variant="amber"
        />
        <StatCard
          label="Failed / Errors"
          value={failed}
          sublabel="Requires review"
          icon={AlertOctagon}
          variant="rose"
        />
      </div>

      {/* Recent Documents Table & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentDocuments
            documents={documents}
            onSelectDoc={handleSelectDoc}
            onUploadClick={() => navigate('/upload')}
          />
        </div>
        <div>
          <ActivityFeed documents={documents} />
        </div>
      </div>
    </div>
  );
};
