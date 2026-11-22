import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Shield,
  User as UserIcon,
  Edit2,
  Trash2,
  Key,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Mail,
  UserCheck,
  Check,
  Layers,
  ChevronRight,
  Info,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { rbacService, Role, Permission } from '../services/rbacService';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/auth';

export const UserManagement: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'users' or 'roles'
  const activeTab = (searchParams.get('tab') === 'roles' ? 'roles' : 'users') as 'users' | 'roles';

  const handleTabChange = (tab: 'users' | 'roles') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'users') {
        next.delete('tab');
      } else {
        next.set('tab', 'roles');
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // User Management State
  // ---------------------------------------------------------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Feedback notifications
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // Form states for Add User
  const [addForm, setAddForm] = useState<CreateUserPayload>({
    full_name: '',
    email: '',
    username: '',
    password: '',
    role: 'user',
    is_active: true,
  });
  const [addLoading, setAddLoading] = useState(false);

  // Form states for Edit User
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    full_name: '',
    email: '',
    username: '',
    role: 'user',
    is_active: true,
    password: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Roles & Permissions State
  // ---------------------------------------------------------------------------
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolesLoading, setRolesLoading] = useState<boolean>(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  // Load Users Callback
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setAlertError(null);
    try {
      const activeParam = statusFilter === '' ? undefined : statusFilter === 'active';
      const res = await authService.getUsers({
        query: searchTerm.trim() || undefined,
        role: roleFilter || undefined,
        is_active: activeParam,
        page,
        limit,
      });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to load user list.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, page]);

  // Load Roles & Permissions Callback
  const loadRolesAndPermissions = useCallback(async () => {
    setRolesLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        rbacService.listRoles(),
        rbacService.listPermissions(),
      ]);
      setRoles(rolesData || []);
      setPermissions(permsData?.permissions || []);
      setGroupedPermissions(permsData?.grouped || {});
      if (rolesData && rolesData.length > 0 && selectedRoleId === null) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err: any) {
      setAlertError(err.message || 'Failed to load roles and permissions.');
    } finally {
      setRolesLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeTab === 'roles') {
      loadRolesAndPermissions();
    }
  }, [activeTab, loadRolesAndPermissions]);

  // Open Edit Modal
  const handleOpenEdit = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setEditForm({
      full_name: userToEdit.full_name,
      email: userToEdit.email,
      username: userToEdit.username,
      role: userToEdit.role,
      is_active: userToEdit.is_active,
      password: '',
    });
    setShowEditModal(true);
  };

  // Toggle User Active / Inactive
  const handleToggleStatus = async (userItem: User) => {
    if (userItem.id === currentAdmin?.id) {
      setAlertError('You cannot deactivate your own administrative account.');
      return;
    }

    try {
      const updated = await authService.toggleUserStatus(userItem.id, !userItem.is_active);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setAlertSuccess(`Account status for "${userItem.username}" set to ${updated.is_active ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setAlertSuccess(null), 3500);
    } catch (err: any) {
      setAlertError(err.message || 'Failed to toggle status.');
    }
  };

  // Handle Create User Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.password || !addForm.email.trim()) {
      setAlertError('Username, Email, and Password are required.');
      return;
    }

    setAddLoading(true);
    setAlertError(null);
    try {
      const created = await authService.createUser(addForm);
      setShowAddModal(false);
      setAddForm({
        full_name: '',
        email: '',
        username: '',
        password: '',
        role: 'user',
        is_active: true,
      });
      setAlertSuccess(`User "${created.username}" created successfully!`);
      setTimeout(() => setAlertSuccess(null), 3500);
      loadUsers();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to create new user.');
    } finally {
      setAddLoading(false);
    }
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setEditLoading(true);
    setAlertError(null);
    try {
      const payload: UpdateUserPayload = {
        full_name: editForm.full_name,
        email: editForm.email,
        username: editForm.username,
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.password && editForm.password.trim().length > 0) {
        payload.password = editForm.password.trim();
      }

      const updated = await authService.updateUser(selectedUser.id, payload);
      setShowEditModal(false);
      setSelectedUser(null);
      setAlertSuccess(`User "${updated.username}" updated successfully!`);
      setTimeout(() => setAlertSuccess(null), 3500);
      loadUsers();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to update user details.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;

    if (deleteConfirmUser.id === currentAdmin?.id) {
      setAlertError('You cannot delete your own active administrative account.');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      await authService.deleteUser(deleteConfirmUser.id);
      setAlertSuccess(`User "${deleteConfirmUser.username}" permanently deleted.`);
      setTimeout(() => setAlertSuccess(null), 3500);
      setDeleteConfirmUser(null);
      loadUsers();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to delete user.');
      setDeleteConfirmUser(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Selected Role for Roles Tab
  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];
  const activeRolePerms = new Set(activeRole?.permissions || []);

  // Filtered Permissions for Matrix
  const availableModules = Object.keys(groupedPermissions).sort();
  const filteredPermissions = permissions.filter((p) => {
    const matchesModule = moduleFilter === 'all' || p.module === moduleFilter;
    const matchesSearch =
      roleSearchTerm.trim() === '' ||
      p.code.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
      p.action.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(roleSearchTerm.toLowerCase()));
    return matchesModule && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header & Unified Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              {activeTab === 'users' ? <Users className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Users & Permissions</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  RBAC Console
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeTab === 'users'
                  ? 'Manage user accounts, assign administrative roles, and activate or deactivate system access.'
                  : 'Inspect system roles, review module permission matrix, and verify security authorization scopes.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'users' && (
            <>
              <button
                onClick={() => loadUsers()}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Refresh User List"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => {
                  setShowAddModal(true);
                  setAlertError(null);
                }}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-brand-500/20 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add New User</span>
              </button>
            </>
          )}

          {activeTab === 'roles' && (
            <button
              onClick={() => loadRolesAndPermissions()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Refresh Roles & Permissions"
            >
              <RefreshCw className={`w-4 h-4 ${rolesLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Matrix</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => handleTabChange('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts</span>
          {total > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === 'users'
                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {total}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles & Permissions</span>
          {roles.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === 'roles'
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {roles.length}
            </span>
          )}
        </button>
      </div>

      {/* Global Alert Banners */}
      {alertError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{alertError}</span>
        </div>
      )}

      {alertSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertSuccess}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: USER ACCOUNTS                                                  */}
      {/* ===================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or username..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 w-1/2 md:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">All Roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Administrator</option>
                  <option value="user">Standard User</option>
                </select>
              </div>

              <div className="w-1/2 md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Created Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                        <span>Loading registered users...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <span>No users found matching the search criteria.</span>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentAdmin?.id;
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                                {u.full_name?.charAt(0).toUpperCase() || u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {u.full_name}
                                  </span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">@{u.username}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {u.email}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'super_admin'
                                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                  : u.role === 'admin'
                                  ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {u.role === 'super_admin' || u.role === 'admin' ? (
                                <Shield className="w-3 h-3 text-purple-600" />
                              ) : (
                                <UserIcon className="w-3 h-3 text-slate-500" />
                              )}
                              <span>{u.role}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              disabled={isSelf}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                                u.is_active
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                              } ${isSelf ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={isSelf ? 'Cannot deactivate self' : 'Click to toggle status'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(u)}
                                className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Edit User Details / Password"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {total > limit && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} users
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ROLES & PERMISSIONS (RBAC)                                     */}
      {/* ===================================================================== */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* RBAC Top Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total System Roles</span>
                <span className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {roles.length}
              </div>
              <span className="text-[11px] text-slate-400">5 Pre-configured System Roles</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">System Permissions</span>
                <span className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Key className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {permissions.length}
              </div>
              <span className="text-[11px] text-slate-400">Across {availableModules.length} core modules</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned Users</span>
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <UserCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {roles.reduce((acc, r) => acc + (r.users_count || 0), 0)}
              </div>
              <span className="text-[11px] text-slate-400">Mapped to security roles</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Security Architecture</span>
                <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Shield className="w-4 h-4" />
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2">
                RBAC & Geographic Scope
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Ward Partitioning Active
              </span>
            </div>
          </div>

          {/* Role Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Configured Roles ({roles.length})</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Click any role card to view or inspect its permissions matrix below.
              </span>
            </div>

            {rolesLoading ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                <span>Loading roles and access controls...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {roles.map((r) => {
                  const isSelected = r.id === (activeRole?.id || selectedRoleId);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      type="button"
                      className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 dark:border-purple-600 shadow-sm ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              r.role_name === 'super_admin'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                : r.role_name === 'admin'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : r.role_name === 'operator'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : r.role_name === 'viewer'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Shield className="w-2.5 h-2.5" />
                            <span>{r.role_name}</span>
                          </span>

                          <span className="text-[10px] font-semibold text-slate-400">
                            {r.is_system ? 'System' : 'Custom'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 mb-3">
                          {r.description || `Default permissions profile for ${r.role_name}.`}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <span>{r.users_count || 0} users</span>
                        </span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {r.permissions?.length || 0} perms
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Granular Permissions Matrix */}
          {activeRole && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
              {/* Matrix Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 px-2.5 py-0.5 rounded-full">
                      {activeRole.role_name}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Authorized Permissions Matrix
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Viewing {filteredPermissions.length} permission(s) •{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {activeRole.permissions?.length || 0} granted
                    </span>{' '}
                    to {activeRole.role_name}
                  </p>
                </div>

                {/* Filters within Permissions Matrix */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  {/* Search Permissions */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={roleSearchTerm}
                      onChange={(e) => setRoleSearchTerm(e.target.value)}
                      placeholder="Filter permission code..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  {/* Module Filter */}
                  <div className="w-full sm:w-auto">
                    <select
                      value={moduleFilter}
                      onChange={(e) => setModuleFilter(e.target.value)}
                      className="w-full sm:w-auto text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="all">All Modules ({availableModules.length})</option>
                      {availableModules.map((mod) => (
                        <option key={mod} value={mod}>
                          {mod.toUpperCase()} ({groupedPermissions[mod]?.length || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Status for {activeRole.role_name}</th>
                      <th className="py-3 px-4">Permission Code</th>
                      <th className="py-3 px-4">Module</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredPermissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          <Info className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          <span>No permissions found matching your criteria.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredPermissions.map((perm) => {
                        const isGranted = activeRolePerms.has(perm.code);
                        return (
                          <tr
                            key={perm.id}
                            className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                              isGranted ? '' : 'opacity-65'
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              {isGranted ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Granted</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                                  <X className="w-3 h-3 text-slate-400" />
                                  <span>Not Granted</span>
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {perm.code}
                            </td>

                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {perm.module}
                              </span>
                            </td>

                            <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300 capitalize">
                              {perm.action.replace('_', ' ')}
                            </td>

                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                              {perm.description || `Allows ${perm.action} action on ${perm.module}.`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Matrix Footer */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Role <strong>{activeRole.role_name}</strong> has{' '}
                    <strong>{activeRole.permissions?.length || 0}</strong> of {permissions.length} total system permissions.
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">
                  System roles are protected by server-side policy guards.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS: ADD USER                                                      */}
      {/* ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Create New User</h3>
                <p className="text-xs text-slate-400">Add an administrator or standard user account</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="ramesh@telugupdf.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  placeholder="rameshk"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={addForm.is_active ? 'true' : 'false'}
                    onChange={(e) => setAddForm({ ...addForm, is_active: e.target.value === 'true' })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
                >
                  {addLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS: EDIT USER                                                     */}
      {/* ===================================================================== */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedUser(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Edit User Details: {selectedUser.username}
                </h3>
                <p className="text-xs text-slate-400">Update account credentials, role, or reset password</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    disabled={selectedUser.id === currentAdmin?.id}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.is_active ? 'true' : 'false'}
                    disabled={selectedUser.id === currentAdmin?.id}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  value={editForm.password || ''}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="New password (optional)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/20"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS: DELETE USER CONFIRMATION                                      */}
      {/* ===================================================================== */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              Delete User Account?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to permanently delete <strong>{deleteConfirmUser.username}</strong> ({deleteConfirmUser.full_name})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
