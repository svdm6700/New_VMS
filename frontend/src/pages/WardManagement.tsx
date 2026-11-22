import React, { useState, useEffect } from 'react';
import {
  Layers,
  Building,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { geoService, Constituency, Ward } from '../services/geoService';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const WardManagement: React.FC = () => {
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [showWardModal, setShowWardModal] = useState<boolean>(false);
  const [wardForm, setWardForm] = useState<{
    id?: number;
    ward_number: string;
    constituency_id?: number;
    constituency_name: string;
    area_name: string;
    description: string;
  }>({
    ward_number: '',
    constituency_name: '',
    area_name: '',
    description: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cList, wList] = await Promise.all([
        geoService.getConstituencies(),
        geoService.getWards(),
      ]);
      setConstituencies(cList);
      setWards(wList);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to load master ward data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardForm.ward_number.trim() || !wardForm.constituency_name.trim()) {
      alert('Please fill Ward Number and select Constituency.');
      return;
    }
    try {
      if (wardForm.id) {
        await geoService.updateWard(wardForm.id, wardForm);
        setMessage({
          type: 'success',
          text: `Ward '${wardForm.ward_number}' updated successfully.`,
        });
      } else {
        await geoService.createWard(wardForm);
        setMessage({
          type: 'success',
          text: `Ward '${wardForm.ward_number}' created successfully.`,
        });
      }
      setShowWardModal(false);
      setWardForm({
        ward_number: '',
        constituency_name: '',
        area_name: '',
        description: '',
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to save ward.',
      });
    }
  };

  const handleDeleteWard = async (w: Ward) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Ward '${w.ward_number}' of ${w.constituency_name}?`
      )
    )
      return;
    try {
      await geoService.deleteWard(w.id);
      setMessage({
        type: 'success',
        text: `Ward '${w.ward_number}' deleted successfully.`,
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to delete ward.',
      });
    }
  };

  // Filtered wards
  const filteredWards = wards.filter((w) => {
    const matchesFilter =
      selectedConstituencyFilter === 'all' ||
      w.constituency_name === selectedConstituencyFilter;
    const matchesSearch =
      w.ward_number.toLowerCase().includes(search.toLowerCase()) ||
      (w.area_name && w.area_name.toLowerCase().includes(search.toLowerCase())) ||
      w.constituency_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate unique constituencies represented
  const constituenciesWithWardsCount = new Set(wards.map((w) => w.constituency_name)).size;

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Super Admin Master Control
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Master Ward & Area Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure master electoral wards, colonies, and polling segments linked to master constituencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setWardForm({
                ward_number: '',
                constituency_name: constituencies[0]?.name || '',
                constituency_id: constituencies[0]?.id,
                area_name: '',
                description: '',
              });
              setShowWardModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Master Ward
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Master Wards
            </span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {wards.length}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Registered electoral wards across all constituencies
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Constituencies with Wards
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {constituenciesWithWardsCount}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Out of {constituencies.length} master constituencies
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Avg Wards / Constituency
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {constituenciesWithWardsCount > 0
              ? (wards.length / constituenciesWithWardsCount).toFixed(1)
              : '0'}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Average ward density in populated constituencies
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Ward Number, Area / Village name, or Constituency..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Filter Constituency:</span>
          <select
            value={selectedConstituencyFilter}
            onChange={(e) => setSelectedConstituencyFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="all">All Constituencies ({wards.length})</option>
            {constituencies.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredWards.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No Wards Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {search || selectedConstituencyFilter !== 'all'
                ? 'Try adjusting your search query or constituency filter.'
                : 'Click "Add Master Ward" to define electoral wards and areas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4">S.No.</th>
                  <th className="py-3 px-4">Ward Number</th>
                  <th className="py-3 px-4">Parent Constituency</th>
                  <th className="py-3 px-4">Area / Locality</th>
                  <th className="py-3 px-4">Description / Remarks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredWards.map((w, index) => (
                  <tr
                    key={w.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        Ward {w.ward_number}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <Building className="w-3.5 h-3.5 text-brand-500" />
                        {w.constituency_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {w.area_name ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {w.area_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None specified</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {w.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setWardForm({
                              id: w.id,
                              ward_number: w.ward_number,
                              constituency_id: w.constituency_id,
                              constituency_name: w.constituency_name,
                              area_name: w.area_name || '',
                              description: w.description || '',
                            });
                            setShowWardModal(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Ward"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWard(w)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Ward"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ward Add / Edit Modal */}
      {showWardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              {wardForm.id ? 'Edit Master Ward' : 'Add Master Ward'}
            </h3>
            <form onSubmit={handleSaveWard} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Parent Constituency *
                </label>
                <select
                  required
                  value={wardForm.constituency_name}
                  onChange={(e) => {
                    const sel = constituencies.find((c) => c.name === e.target.value);
                    setWardForm({
                      ...wardForm,
                      constituency_name: e.target.value,
                      constituency_id: sel?.id,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select Constituency</option>
                  {constituencies.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ward Number / Code *
                </label>
                <input
                  type="text"
                  required
                  value={wardForm.ward_number}
                  onChange={(e) => setWardForm({ ...wardForm, ward_number: e.target.value })}
                  placeholder="e.g. 1, 2, or Ward 12"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Area / Locality / Village Name
                </label>
                <input
                  type="text"
                  value={wardForm.area_name}
                  onChange={(e) => setWardForm({ ...wardForm, area_name: e.target.value })}
                  placeholder="e.g. Subba Rao Colony / Market Yard"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={wardForm.description}
                  onChange={(e) => setWardForm({ ...wardForm, description: e.target.value })}
                  placeholder="Additional electoral details or polling booth coverage..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWardModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
