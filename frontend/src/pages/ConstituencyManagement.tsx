import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Layers,
  MapPin,
  Building,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FolderTree,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Check
} from 'lucide-react';
import { geoService, District, Constituency, Ward } from '../services/geoService';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type TabType = 'constituencies' | 'wards' | 'hierarchy';

export const ConstituencyManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'constituencies';
  const initialConstituency = searchParams.get('constituency') || 'all';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [districts, setDistricts] = useState<District[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter state for Constituencies tab
  const [cSearch, setCSearch] = useState<string>('');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');

  // Search & Filter state for Wards tab
  const [wSearch, setWSearch] = useState<string>('');
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState<string>(initialConstituency);

  // Hierarchy view expand/collapse state
  const [expandedDistricts, setExpandedDistricts] = useState<Record<number, boolean>>({});
  const [expandedConstituencies, setExpandedConstituencies] = useState<Record<number, boolean>>({});

  // Modals state
  const [showDistrictModal, setShowDistrictModal] = useState<boolean>(false);
  const [districtForm, setDistrictForm] = useState<{ id?: number; name: string; code: string; state: string }>({
    name: '',
    code: '',
    state: 'Andhra Pradesh',
  });

  const [showConstituencyModal, setShowConstituencyModal] = useState<boolean>(false);
  const [constituencyForm, setConstituencyForm] = useState<{
    id?: number;
    name: string;
    code: string;
    district_id?: number;
    district_name: string;
  }>({
    name: '',
    code: '',
    district_name: '',
  });

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

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType;
    if (tabParam && ['constituencies', 'wards', 'hierarchy'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const cParam = searchParams.get('constituency');
    if (cParam) {
      setSelectedConstituencyFilter(cParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType, constituencyFilter?: string) => {
    setActiveTab(tab);
    const newParams: Record<string, string> = { tab };
    if (constituencyFilter) {
      newParams.constituency = constituencyFilter;
      setSelectedConstituencyFilter(constituencyFilter);
    }
    setSearchParams(newParams);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dList, cList, wList] = await Promise.all([
        geoService.getDistricts(),
        geoService.getConstituencies(),
        geoService.getWards(),
      ]);
      setDistricts(dList);
      setConstituencies(cList);
      setWards(wList);

      // Default expand first district & constituency in hierarchy
      if (dList.length > 0) {
        setExpandedDistricts({ [dList[0].id]: true });
      }
      if (cList.length > 0) {
        setExpandedConstituencies({ [cList[0].id]: true });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to load master geographic data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // District Actions
  const handleSaveDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtForm.name.trim()) return;
    try {
      if (districtForm.id) {
        await geoService.updateDistrict(districtForm.id, districtForm);
        setMessage({ type: 'success', text: `District '${districtForm.name}' updated successfully.` });
      } else {
        await geoService.createDistrict(districtForm);
        setMessage({ type: 'success', text: `District '${districtForm.name}' created successfully.` });
      }
      setShowDistrictModal(false);
      setDistrictForm({ name: '', code: '', state: 'Andhra Pradesh' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to save district.' });
    }
  };

  const handleDeleteDistrict = async (d: District) => {
    if (
      !window.confirm(
        `Are you sure you want to delete District '${d.name}'? All linked constituencies and wards will be removed.`
      )
    )
      return;
    try {
      await geoService.deleteDistrict(d.id);
      setMessage({ type: 'success', text: `District '${d.name}' deleted successfully.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to delete district.' });
    }
  };

  // Constituency Actions
  const handleSaveConstituency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!constituencyForm.name.trim() || !constituencyForm.district_name.trim()) {
      alert('Please fill Constituency Name and select District.');
      return;
    }
    try {
      if (constituencyForm.id) {
        await geoService.updateConstituency(constituencyForm.id, constituencyForm);
        setMessage({ type: 'success', text: `Constituency '${constituencyForm.name}' updated successfully.` });
      } else {
        await geoService.createConstituency(constituencyForm);
        setMessage({ type: 'success', text: `Constituency '${constituencyForm.name}' created successfully.` });
      }
      setShowConstituencyModal(false);
      setConstituencyForm({ name: '', code: '', district_name: '' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to save constituency.' });
    }
  };

  const handleDeleteConstituency = async (c: Constituency) => {
    if (!window.confirm(`Are you sure you want to delete Constituency '${c.name}'?`)) return;
    try {
      await geoService.deleteConstituency(c.id);
      setMessage({ type: 'success', text: `Constituency '${c.name}' deleted successfully.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to delete constituency.' });
    }
  };

  // Ward Actions
  const handleSaveWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardForm.ward_number.trim() || !wardForm.constituency_name.trim()) {
      alert('Please fill Ward Number and select Constituency.');
      return;
    }
    try {
      if (wardForm.id) {
        await geoService.updateWard(wardForm.id, wardForm);
        setMessage({ type: 'success', text: `Ward '${wardForm.ward_number}' updated successfully.` });
      } else {
        await geoService.createWard(wardForm);
        setMessage({ type: 'success', text: `Ward '${wardForm.ward_number}' created successfully.` });
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
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to save ward.' });
    }
  };

  const handleDeleteWard = async (w: Ward) => {
    if (!window.confirm(`Are you sure you want to delete Ward '${w.ward_number}' of ${w.constituency_name}?`))
      return;
    try {
      await geoService.deleteWard(w.id);
      setMessage({ type: 'success', text: `Ward '${w.ward_number}' deleted successfully.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to delete ward.' });
    }
  };

  // Filters
  const filteredConstituencies = constituencies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(cSearch.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(cSearch.toLowerCase())) ||
      c.district_name.toLowerCase().includes(cSearch.toLowerCase());
    const matchesDistrict = selectedDistrictFilter === 'all' || c.district_name === selectedDistrictFilter;
    return matchesSearch && matchesDistrict;
  });

  const filteredWards = wards.filter((w) => {
    const matchesFilter =
      selectedConstituencyFilter === 'all' || w.constituency_name === selectedConstituencyFilter;
    const matchesSearch =
      w.ward_number.toLowerCase().includes(wSearch.toLowerCase()) ||
      (w.area_name && w.area_name.toLowerCase().includes(wSearch.toLowerCase())) ||
      w.constituency_name.toLowerCase().includes(wSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const constituenciesWithWardsCount = new Set(wards.map((w) => w.constituency_name)).size;

  return (
    <div className="space-y-6">
      {/* Unified Master Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Super Admin Master Control
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            <span>Constituency & Ward Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative master catalog of Districts, Assembly Constituencies, Electoral Wards, and Localities.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh Data"
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setDistrictForm({ name: '', code: '', state: 'Andhra Pradesh' });
              setShowDistrictModal(true);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add District</span>
          </button>

          <button
            onClick={() => {
              setConstituencyForm({
                name: '',
                code: '',
                district_id: districts[0]?.id,
                district_name: districts[0]?.name || '',
              });
              setShowConstituencyModal(true);
            }}
            className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-brand-600" />
            <span>Add Constituency</span>
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
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ward</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-base">
            ×
          </button>
        </div>
      )}

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Districts</span>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{districts.length}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Admin jurisdictions</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Constituencies</span>
            <Building2 className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">{constituencies.length}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Assembly segments</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Master Wards</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{wards.length}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Electoral divisions</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coverage</span>
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{constituenciesWithWardsCount}/{constituencies.length} Active</span>
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Andhra Pradesh state</p>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm flex items-center gap-1">
        <button
          onClick={() => handleTabChange('constituencies')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'constituencies'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Constituencies & Districts</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'constituencies'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {constituencies.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('wards')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'wards'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Wards & Areas</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'wards'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {wards.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('hierarchy')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'hierarchy'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Hierarchy Tree View</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CONSTITUENCIES & DISTRICTS */}
      {/* ===================================================================== */}
      {activeTab === 'constituencies' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filter and Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search constituencies by name or code..."
                value={cSearch}
                onChange={(e) => setCSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 whitespace-nowrap">Filter District:</span>
              <select
                value={selectedDistrictFilter}
                onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Districts ({constituencies.length})</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Master Constituencies Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Registered Constituencies ({filteredConstituencies.length})
              </h2>
            </div>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner label="Loading master geographic units..." />
              </div>
            ) : filteredConstituencies.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No constituencies found matching current search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Constituency Name</th>
                      <th className="py-3 px-4">District</th>
                      <th className="py-3 px-4">Wards Count</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredConstituencies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-500">{c.code || '-'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-brand-600" />
                          <span>{c.name}</span>
                        </td>
                        <td className="py-3 px-4">{c.district_name}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleTabChange('wards', c.name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors"
                            title="Click to view & manage wards for this constituency"
                          >
                            <Layers className="w-3 h-3 text-indigo-500" />
                            <span>{c.wards_count} wards</span>
                            <ArrowRight className="w-3 h-3 opacity-60" />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => handleTabChange('wards', c.name)}
                            className="px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                            title="Manage Wards"
                          >
                            Manage Wards
                          </button>
                          <button
                            onClick={() => {
                              setConstituencyForm({
                                id: c.id,
                                name: c.name,
                                code: c.code || '',
                                district_id: c.district_id,
                                district_name: c.district_name,
                              });
                              setShowConstituencyModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Constituency"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteConstituency(c)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Constituency"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Compact District Reference Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                <span>Districts Master List ({districts.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDistrictForm({ name: '', code: '', state: 'Andhra Pradesh' });
                  setShowDistrictModal(true);
                }}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add District</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {districts.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{d.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Code: <span className="font-mono">{d.code || '—'}</span> · {d.state}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setDistrictForm({ id: d.id, name: d.name, code: d.code || '', state: d.state });
                        setShowDistrictModal(true);
                      }}
                      className="p-1 text-slate-400 hover:text-brand-600 rounded"
                      title="Edit District"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteDistrict(d)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete District"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: WARDS & AREAS */}
      {/* ===================================================================== */}
      {activeTab === 'wards' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filter and Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Ward Number, Area / Village name, or Constituency..."
                value={wSearch}
                onChange={(e) => setWSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 whitespace-nowrap">Filter Constituency:</span>
              <select
                value={selectedConstituencyFilter}
                onChange={(e) => {
                  setSelectedConstituencyFilter(e.target.value);
                  const newParams: Record<string, string> = { tab: 'wards' };
                  if (e.target.value !== 'all') newParams.constituency = e.target.value;
                  setSearchParams(newParams);
                }}
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

          {/* Wards Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Registered Electoral Wards ({filteredWards.length})
                {selectedConstituencyFilter !== 'all' && (
                  <span className="ml-2 font-normal text-brand-600 dark:text-brand-400">
                    in {selectedConstituencyFilter}
                  </span>
                )}
              </h2>
            </div>

            {isLoading ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredWards.length === 0 ? (
              <div className="py-16 text-center">
                <Layers className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Wards Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {wSearch || selectedConstituencyFilter !== 'all'
                    ? 'Try adjusting your search query or constituency filter.'
                    : 'Click "Add Ward" above to define master electoral wards.'}
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
                      <tr key={w.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: HIERARCHY TREE VIEW */}
      {/* ===================================================================== */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-brand-600" />
                  <span>Geographic Structure Hierarchy</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Expand districts and constituencies to explore nested electoral wards and localities.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allDistricts = districts.reduce((acc, d) => ({ ...acc, [d.id]: true }), {});
                    const allConst = constituencies.reduce((acc, c) => ({ ...acc, [c.id]: true }), {});
                    setExpandedDistricts(allDistricts);
                    setExpandedConstituencies(allConst);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedDistricts({});
                    setExpandedConstituencies({});
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Tree Container */}
            <div className="space-y-3">
              {districts.map((d) => {
                const dConstituencies = constituencies.filter((c) => c.district_name === d.name);
                const isDistExpanded = !!expandedDistricts[d.id];

                return (
                  <div
                    key={d.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    {/* District Header */}
                    <div
                      onClick={() =>
                        setExpandedDistricts((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                      }
                      className="p-3.5 bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {isDistExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{d.name}</span>
                        {d.code && <span className="font-mono text-[10px] text-slate-400">({d.code})</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                          {dConstituencies.length} Constituencies
                        </span>
                      </div>
                    </div>

                    {/* Constituencies under District */}
                    {isDistExpanded && (
                      <div className="p-3 pl-8 space-y-2 border-t border-slate-200 dark:border-slate-800">
                        {dConstituencies.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-1">No constituencies registered in this district.</p>
                        ) : (
                          dConstituencies.map((c) => {
                            const cWards = wards.filter((w) => w.constituency_name === c.name);
                            const isConstExpanded = !!expandedConstituencies[c.id];

                            return (
                              <div
                                key={c.id}
                                className="border border-slate-200/80 dark:border-slate-700/60 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
                              >
                                {/* Constituency Header */}
                                <div
                                  onClick={() =>
                                    setExpandedConstituencies((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                  }
                                  className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer flex items-center justify-between transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {isConstExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      {c.name}
                                    </span>
                                    {c.code && (
                                      <span className="text-[10px] font-mono text-slate-400">#{c.code}</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                      {cWards.length} Wards
                                    </span>
                                  </div>
                                </div>

                                {/* Wards in Constituency */}
                                {isConstExpanded && (
                                  <div className="p-3 pl-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                                    {cWards.length === 0 ? (
                                      <p className="text-[11px] text-slate-400 italic">No wards registered under this constituency.</p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {cWards.map((w) => (
                                          <div
                                            key={w.id}
                                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/50 flex items-center gap-2 text-xs"
                                          >
                                            <span className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                                              W{w.ward_number}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                Ward {w.ward_number}
                                              </p>
                                              {w.area_name && (
                                                <p className="text-[10px] text-slate-400 truncate">{w.area_name}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}

      {/* District Modal */}
      {showDistrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-600" />
              <span>{districtForm.id ? 'Edit District' : 'Add Master District'}</span>
            </h3>
            <form onSubmit={handleSaveDistrict} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  District Name (English / Telugu) *
                </label>
                <input
                  type="text"
                  required
                  value={districtForm.name}
                  onChange={(e) => setDistrictForm({ ...districtForm, name: e.target.value })}
                  placeholder="e.g. పశ్చిమ గోదావరి (West Godavari)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">District Code</label>
                <input
                  type="text"
                  value={districtForm.code}
                  onChange={(e) => setDistrictForm({ ...districtForm, code: e.target.value })}
                  placeholder="e.g. WG"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">State</label>
                <input
                  type="text"
                  value={districtForm.state}
                  onChange={(e) => setDistrictForm({ ...districtForm, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDistrictModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save District
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Constituency Modal */}
      {showConstituencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span>{constituencyForm.id ? 'Edit Constituency' : 'Add Master Constituency'}</span>
            </h3>
            <form onSubmit={handleSaveConstituency} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Parent District *
                </label>
                <select
                  required
                  value={constituencyForm.district_name}
                  onChange={(e) => {
                    const sel = districts.find((d) => d.name === e.target.value);
                    setConstituencyForm({
                      ...constituencyForm,
                      district_name: e.target.value,
                      district_id: sel?.id,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select District</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Constituency Name (English / Telugu) *
                </label>
                <input
                  type="text"
                  required
                  value={constituencyForm.name}
                  onChange={(e) => setConstituencyForm({ ...constituencyForm, name: e.target.value })}
                  placeholder="e.g. తాడేపల్లిగూడెం (Tadepalligudem)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Constituency Code / Assembly No.
                </label>
                <input
                  type="text"
                  value={constituencyForm.code}
                  onChange={(e) => setConstituencyForm({ ...constituencyForm, code: e.target.value })}
                  placeholder="e.g. 62"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConstituencyModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Constituency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ward Modal */}
      {showWardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>{wardForm.id ? 'Edit Master Ward' : 'Add Master Ward'}</span>
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
