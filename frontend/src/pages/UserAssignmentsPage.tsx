import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Building,
  Layers,
  Plus,
  Search,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  UserCheck,
  User as UserIcon,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { geoService } from '../services/geoService';
import { authService } from '../services/authService';
import { GeographicAssignment } from '../types/wallet';
import { User } from '../types/auth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const UserAssignmentsPage: React.FC = () => {
  const { isSuperAdmin, isAdmin } = useAuth();

  const [assignments, setAssignments] = useState<GeographicAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<{ districts: string[]; constituencies: string[]; wards: string[] }>({
    districts: [],
    constituencies: [],
    wards: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [constituencyFilter, setConstituencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [assignmentForm, setAssignmentForm] = useState<{
    user_id: number;
    district: string;
    constituency: string;
    wardsInput: string;
    area: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    user_id: 0,
    district: '',
    constituency: '',
    wardsInput: '',
    area: '',
    status: 'ACTIVE',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assigns, locs, usersResp] = await Promise.all([
        geoService.getUserAssignments(),
        geoService.getLocations(),
        authService.getUsers({ limit: 100 }),
      ]);
      setAssignments(assigns);
      setLocations(locs);

      // Filter users who can receive assignments
      // Super Admin can assign Admins and Users.
      // Admin can only assign standard Users.
      const candidateUsers = usersResp.users.filter((u) => {
        if (isSuperAdmin) {
          return u.role.toLowerCase() !== 'super_admin' && u.role.toLowerCase() !== 'superadmin';
        }
        return u.role.toLowerCase() === 'user';
      });
      setUsers(candidateUsers);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to load assignment data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.user_id) {
      alert('Please select a user to assign.');
      return;
    }
    if (!assignmentForm.district.trim() || !assignmentForm.constituency.trim()) {
      alert('Please provide District and Constituency.');
      return;
    }

    setFormLoading(true);
    try {
      const parsedWards = assignmentForm.wardsInput
        .split(',')
        .map((w) => w.trim())
        .filter((w) => w.length > 0);

      await geoService.createUserAssignment({
        user_id: assignmentForm.user_id,
        district: assignmentForm.district.trim(),
        constituency: assignmentForm.constituency.trim(),
        wards: parsedWards.length > 0 ? parsedWards : ['ALL'],
        area: assignmentForm.area.trim() || undefined,
        status: assignmentForm.status,
      });

      setMessage({ type: 'success', text: 'Geographic assignment created successfully.' });
      setShowModal(false);
      setAssignmentForm({
        user_id: 0,
        district: '',
        constituency: '',
        wardsInput: '',
        area: '',
        status: 'ACTIVE',
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to create assignment.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (item: GeographicAssignment) => {
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await geoService.updateUserAssignment(item.id, { status: newStatus });
      setMessage({
        type: 'success',
        text: `Assignment status changed to ${newStatus}.`,
      });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to update assignment status.',
      });
    }
  };

  const handleDeleteAssignment = async (item: GeographicAssignment) => {
    if (
      !window.confirm(
        `Are you sure you want to remove geographic assignment for '${item.user_username || item.user_full_name}'?`
      )
    )
      return;
    try {
      await geoService.deleteUserAssignment(item.id);
      setMessage({ type: 'success', text: 'Geographic assignment removed.' });
      fetchData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to delete assignment.',
      });
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const matchesConstituency =
      constituencyFilter === 'all' || a.constituency === constituencyFilter;
    const matchesStatus =
      statusFilter === 'all' || a.status.toUpperCase() === statusFilter.toUpperCase();
    const matchesSearch =
      (a.user_username && a.user_username.toLowerCase().includes(search.toLowerCase())) ||
      (a.user_full_name && a.user_full_name.toLowerCase().includes(search.toLowerCase())) ||
      a.constituency.toLowerCase().includes(search.toLowerCase()) ||
      a.district.toLowerCase().includes(search.toLowerCase()) ||
      (a.area && a.area.toLowerCase().includes(search.toLowerCase()));
    return matchesConstituency && matchesStatus && matchesSearch;
  });

  const activeCount = assignments.filter((a) => a.status === 'ACTIVE').length;
  const uniqueConstituencies = new Set(assignments.map((a) => a.constituency)).size;
  const uniqueUsers = new Set(assignments.map((a) => a.user_id)).size;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                isSuperAdmin
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                  : 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200 dark:border-brand-900/50'
              }`}
            >
              <Shield className="w-3 h-3" />
              {isSuperAdmin ? 'Super Admin Master Access' : 'Admin Delegated Access'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            User Geographic Assignments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isSuperAdmin
              ? 'Assign Districts, Constituencies, and Wards to Regional Admins and Field Users.'
              : 'Assign Constituencies and Wards to Users strictly within your permitted administrative scope.'}
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
              setAssignmentForm({
                user_id: users[0]?.id || 0,
                district: locations.districts[0] || '',
                constituency: locations.constituencies[0] || '',
                wardsInput: '',
                area: '',
                status: 'ACTIVE',
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> New Assignment
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Assignments
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{activeCount}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Total active user geographic allocations
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assigned Constituencies
            </span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{uniqueConstituencies}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Distinct electoral areas actively staffed
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Covered Users
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <UserIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{uniqueUsers}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
            Distinct operational accounts with scope
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by username, full name, constituency, or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Constituency:</span>
          <select
            value={constituencyFilter}
            onChange={(e) => setConstituencyFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="all">All ({assignments.length})</option>
            {locations.constituencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="py-16 text-center">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No Geographic Assignments Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {search || constituencyFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'Click "New Assignment" to allocate electoral areas to users.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Constituency</th>
                  <th className="py-3 px-4">Assigned Wards</th>
                  <th className="py-3 px-4">Area / Locality</th>
                  <th className="py-3 px-4">Assigned By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredAssignments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {a.user_full_name || a.user_username}
                        </span>
                        <span className="text-2xs text-slate-400 font-mono">
                          @{a.user_username || `ID:${a.user_id}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {a.district}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <Building className="w-3.5 h-3.5 text-brand-500" />
                        {a.constituency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {a.wards && a.wards.length > 0 ? (
                          a.wards.map((w, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50"
                            >
                              Ward {w}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            All Wards
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {a.area || <span className="text-slate-400 italic">All Areas</span>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-2xs">
                      {a.assigner_username ? `@${a.assigner_username}` : 'System'}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(a)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold transition-colors ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {a.status === 'ACTIVE' ? (
                          <>
                            <ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-3.5 h-3.5 text-slate-400" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteAssignment(a)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete Assignment"
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

      {/* New Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-600" />
              New Geographic Assignment
            </h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assignee User *
                </label>
                <select
                  required
                  value={assignmentForm.user_id}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, user_id: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value={0}>Select User</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} (@{u.username} - {u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  District *
                </label>
                {locations.districts.length > 0 ? (
                  <select
                    required
                    value={assignmentForm.district}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, district: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">Select District</option>
                    {locations.districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={assignmentForm.district}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, district: e.target.value })
                    }
                    placeholder="e.g. West Godavari"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Constituency *
                </label>
                {locations.constituencies.length > 0 ? (
                  <select
                    required
                    value={assignmentForm.constituency}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, constituency: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">Select Constituency</option>
                    {locations.constituencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={assignmentForm.constituency}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, constituency: e.target.value })
                    }
                    placeholder="e.g. Tadepalligudem"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Wards (Comma-separated, or 'ALL')
                </label>
                <input
                  type="text"
                  value={assignmentForm.wardsInput}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, wardsInput: e.target.value })
                  }
                  placeholder="e.g. 1, 2, 3 or ALL"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <p className="text-3xs text-slate-400 mt-1">
                  Leave empty or enter 'ALL' to grant access across all wards of this constituency.
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Specific Area / Village / Locality
                </label>
                <input
                  type="text"
                  value={assignmentForm.area}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, area: e.target.value })}
                  placeholder="e.g. Town Center (Optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
                >
                  {formLoading ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
