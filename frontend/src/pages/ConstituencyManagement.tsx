import React, { useState, useEffect } from 'react';
import {
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
  FolderTree
} from 'lucide-react';
import { geoService, District, Constituency } from '../services/geoService';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const ConstituencyManagement: React.FC = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dList, cList] = await Promise.all([
        geoService.getDistricts(),
        geoService.getConstituencies(),
      ]);
      setDistricts(dList);
      setConstituencies(cList);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to load master geographic data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    if (!window.confirm(`Are you sure you want to delete District '${d.name}'? All linked constituencies and wards will be removed.`)) return;
    try {
      await geoService.deleteDistrict(d.id);
      setMessage({ type: 'success', text: `District '${d.name}' deleted successfully.` });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to delete district.' });
    }
  };

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

  const filteredConstituencies = constituencies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
      c.district_name.toLowerCase().includes(search.toLowerCase());
    const matchesDistrict = selectedDistrictFilter === 'all' || c.district_name === selectedDistrictFilter;
    return matchesSearch && matchesDistrict;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Super Admin Exclusive
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Building className="w-5 h-5 text-brand-600" />
            <span>Constituency & District Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative master catalog of Districts, Assembly Constituencies, and administrative regional units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDistrictForm({ name: '', code: '', state: 'Andhra Pradesh' });
              setShowDistrictModal(true);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
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
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Constituency</span>
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
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Districts</p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{districts.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Constituencies</p>
          <p className="text-2xl font-black text-brand-600 mt-1">{constituencies.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">State Coverage</p>
          <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Andhra Pradesh
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search constituencies by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedDistrictFilter}
            onChange={(e) => setSelectedDistrictFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {c.wards_count} wards
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
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
                        className="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit Constituency"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteConstituency(c)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

      {/* District Modal */}
      {showDistrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              {districtForm.id ? 'Edit District' : 'Add Master District'}
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              {constituencyForm.id ? 'Edit Constituency' : 'Add Master Constituency'}
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
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Constituency Code / Assembly No.</label>
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
    </div>
  );
};
