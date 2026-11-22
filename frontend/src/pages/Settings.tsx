import React, { useState, useEffect, useCallback } from 'react';
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
  Shield,
  Users,
  FileText,
  PlusCircle,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  Check,
  ShieldAlert,
  Loader2,
  X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDocuments } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { documentService } from '../services/documentService';
import {
  rbacService,
  Role,
  Permission,
  RbacUser,
  AuditLog
} from '../services/rbacService';
import { API_BASE_URL } from '../services/api';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { backendOnline } = useDocuments();
  const { user, isAdmin } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'users' | 'audit'>('general');

  // General Settings State
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<{ status: string; timestamp?: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // RBAC Roles State
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Role Create / Edit Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  // Role Delete Modal State
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState(false);
  const [deleteRoleError, setDeleteRoleError] = useState<string | null>(null);

  // Assigned Users State
  const [rbacUsers, setRbacUsers] = useState<RbacUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignUserModal, setAssignUserModal] = useState<RbacUser | null>(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState<string>('');
  const [savingAssignRole, setSavingAssignRole] = useState(false);
  const [assignRoleError, setAssignRoleError] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Load RBAC Data
  const loadRolesAndPermissions = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        rbacService.listRoles(),
        rbacService.listPermissions(),
      ]);
      setRoles(rolesData);
      setAllPermissions(permsData.permissions || []);
      setGroupedPermissions(permsData.grouped || {});

      // Preserve or set default selected role
      if (rolesData.length > 0) {
        setSelectedRole((prev) => {
          if (!prev) return rolesData[0];
          const found = rolesData.find((r) => r.id === prev.id);
          return found || rolesData[0];
        });
      }
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to load roles and permissions.');
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const usersData = await rbacService.listUsers();
      setRbacUsers(usersData);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const logs = await rbacService.getAuditLogs(100);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'roles') {
      loadRolesAndPermissions();
    } else if (activeTab === 'users') {
      loadUsers();
      loadRolesAndPermissions();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadRolesAndPermissions, loadUsers, loadAuditLogs]);

  // Sync role permissions when selected role changes
  useEffect(() => {
    if (selectedRole) {
      setRolePermissions(selectedRole.permissions || []);
      setSaveSuccessMsg(null);
      setSaveErrorMsg(null);
    }
  }, [selectedRole]);

  // General tab: Health check
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

  // Permission toggles
  const handleTogglePermission = (code: string) => {
    if (!selectedRole || selectedRole.role_name === 'admin') return;
    setRolePermissions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleToggleModule = (moduleName: string, perms: Permission[]) => {
    if (!selectedRole || selectedRole.role_name === 'admin') return;
    const codes = perms.map((p) => p.code);
    const allSelected = codes.every((c) => rolePermissions.includes(c));

    if (allSelected) {
      // Unselect all
      setRolePermissions((prev) => prev.filter((c) => !codes.includes(c)));
    } else {
      // Select all in module
      setRolePermissions((prev) => Array.from(new Set([...prev, ...codes])));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const res = await rbacService.updateRole(selectedRole.id, {
        permission_codes: rolePermissions,
      });
      setSaveSuccessMsg(`Permissions for role "${res.role.role_name}" saved successfully!`);
      // Update local state
      setRoles((prev) => prev.map((r) => (r.id === res.role.id ? res.role : r)));
      setSelectedRole(res.role);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to update role permissions.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetPermissions = () => {
    if (selectedRole) {
      setRolePermissions(selectedRole.permissions || []);
      setSaveSuccessMsg(null);
      setSaveErrorMsg(null);
    }
  };

  // Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setCreateRoleError('Role name is required.');
      return;
    }

    setCreatingRole(true);
    setCreateRoleError(null);
    try {
      const res = await rbacService.createRole({
        role_name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
        permission_codes: [],
      });
      setShowCreateModal(false);
      setNewRoleName('');
      setNewRoleDesc('');
      await loadRolesAndPermissions();
      setSelectedRole(res.role);
      setSaveSuccessMsg(`Role "${res.role.role_name}" created successfully!`);
    } catch (err: any) {
      setCreateRoleError(err.message || 'Failed to create role.');
    } finally {
      setCreatingRole(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setDeletingRole(true);
    setDeleteRoleError(null);
    try {
      await rbacService.deleteRole(deleteRoleTarget.id);
      setDeleteRoleTarget(null);
      await loadRolesAndPermissions();
    } catch (err: any) {
      setDeleteRoleError(err.message || 'Failed to delete role.');
    } finally {
      setDeletingRole(false);
    }
  };

  // Assign User Role
  const handleSaveUserRole = async () => {
    if (!assignUserModal || !selectedAssignRole) return;
    setSavingAssignRole(true);
    setAssignRoleError(null);
    try {
      await rbacService.assignUserRole(assignUserModal.id, selectedAssignRole);
      setAssignUserModal(null);
      await loadUsers();
      await loadRolesAndPermissions();
    } catch (err: any) {
      setAssignRoleError(err.message || 'Failed to assign role to user.');
    } finally {
      setSavingAssignRole(false);
    }
  };

  const moduleDisplayNames: Record<string, string> = {
    voters: 'Voter Records & Directory',
    voter_entries: 'Voter Entries & Payments',
    documents: 'Voter Documents & Upload',
    users: 'User Management & Accounts',
    settings: 'System Settings & RBAC',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-brand-600" />
            Application Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure system preferences, role-based access control (RBAC), and security audit trails.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'general'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'roles'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles & Permissions</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Assigned Users</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${activeTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Logs</span>
          </button>
        </div>
      </div>

      {/* TAB 1: GENERAL PREFERENCES */}
      {activeTab === 'general' && (
        <div className="space-y-6 max-w-3xl">
          {/* Theme Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Appearance & Theme</h3>
              <p className="text-xs text-slate-400">Choose your preferred dashboard interface style</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${theme === 'light'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <Sun className="w-5 h-5 text-amber-500" />
                <span>Light Mode</span>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${theme === 'dark'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <Moon className="w-5 h-5 text-indigo-400" />
                <span>Dark Mode</span>
              </button>

              <button
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-xs font-semibold transition-all ${theme === 'system'
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
                <p className="text-xs text-slate-400">Database Engine: PostgreSQL 16+ (psycopg 3)</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${backendOnline
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {backendOnline ? 'Operational' : 'Disconnected'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300">
              API Base URL: <span className="font-bold text-brand-600 dark:text-brand-400">{API_BASE_URL}</span>
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
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800/80 border border-brand-200/60 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Role-Based Access Control (RBAC)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage roles, granular module permissions, and security policies dynamically from PostgreSQL.
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setNewRoleName('');
                  setNewRoleDesc('');
                  setCreateRoleError(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Role</span>
              </button>
            )}
          </div>

          {/* Roles Selector & Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Roles Sidebar / List */}
            <div className="lg:col-span-1 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Configured Roles ({roles.length})
              </h4>

              {loadingRoles ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-brand-600" />
                  Loading roles...
                </div>
              ) : (
                <div className="space-y-2">
                  {roles.map((r) => {
                    const isSelected = selectedRole?.id === r.id;
                    const isSys = r.is_system;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRole(r)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${isSelected
                            ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-500 dark:border-brand-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 capitalize">
                            {r.role_name}
                          </span>
                          {isSys ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                              System
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Custom
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {r.description || 'No description'}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{r.users_count || 0} assigned users</span>
                          <span>{r.permissions?.length || 0} perms</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Role Permissions Matrix */}
            <div className="lg:col-span-3">
              {selectedRole ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
                  {/* Role Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 capitalize">
                          {selectedRole.role_name}
                        </h3>
                        {selectedRole.is_system && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            System Role
                          </span>
                        )}
                        {selectedRole.role_name === 'admin' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            Full Access
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {selectedRole.description || 'Configure granular access for this role.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {!selectedRole.is_system && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteRoleTarget(selectedRole)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Role</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleResetPermissions}
                        disabled={savingPermissions || selectedRole.role_name === 'admin'}
                        className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                      >
                        Reset
                      </button>

                      <button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={savingPermissions || selectedRole.role_name === 'admin'}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {savingPermissions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Save Permissions</span>
                      </button>
                    </div>
                  </div>

                  {/* Alerts */}
                  {selectedRole.role_name === 'admin' && (
                    <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 rounded-2xl text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        The <strong>Administrator</strong> system role inherently possesses full bypass rights across all modules and cannot be downgraded or restricted.
                      </span>
                    </div>
                  )}

                  {saveSuccessMsg && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {saveErrorMsg && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{saveErrorMsg}</span>
                    </div>
                  )}

                  {/* Module-wise Permissions Matrix */}
                  <div className="space-y-4">
                    {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                      const allModuleSelected = perms.every((p) => rolePermissions.includes(p.code));
                      const someModuleSelected = perms.some((p) => rolePermissions.includes(p.code));
                      const isRoleAdmin = selectedRole.role_name === 'admin';

                      return (
                        <div
                          key={moduleName}
                          className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/20 space-y-3"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                            <div>
                              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                {moduleDisplayNames[moduleName] || moduleName}
                              </h5>
                              <p className="text-[11px] text-slate-400">
                                {perms.length} available actions
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={isRoleAdmin}
                              onClick={() => handleToggleModule(moduleName, perms)}
                              className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40"
                            >
                              {allModuleSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {perms.map((perm) => {
                              const isChecked = isRoleAdmin || rolePermissions.includes(perm.code);
                              return (
                                <label
                                  key={perm.code}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${isChecked
                                      ? 'bg-white dark:bg-slate-800 border-brand-200 dark:border-brand-900 shadow-2xs'
                                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 text-slate-500'
                                    } ${isRoleAdmin ? 'cursor-not-allowed opacity-90' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={isRoleAdmin}
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(perm.code)}
                                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500/20 disabled:cursor-not-allowed"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate capitalize">
                                      {perm.action.replace('_', ' ')}
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                      {perm.description || perm.code}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  Select a role on the left to inspect or modify permissions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSIGNED USERS */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                User Roles & Account Assignments
              </h3>
              <p className="text-xs text-slate-400">
                View all registered accounts and assign them to system or custom roles.
              </p>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>Refresh Users</span>
            </button>
          </div>

          {loadingUsers ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rbacUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-xs">
                            {u.full_name?.charAt(0).toUpperCase() || u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {u.full_name}
                            </p>
                            <p className="text-[10px] text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : u.role === 'operator'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignUserModal(u);
                              setSelectedAssignRole(u.role);
                              setAssignRoleError(null);
                            }}
                            className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Change Role
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Security & RBAC Audit Trail
              </h3>
              <p className="text-xs text-slate-400">
                Immutable security logs of role changes, permission modifications, and user assignments.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={loadingAudit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {loadingAudit ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        @{log.username || `User #${log.user_id}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-md truncate font-sans">
                        {log.details || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-600" />
                <span>Create New Custom Role</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createRoleError && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createRoleError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRole} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. supervisor, verifier, auditor"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lowercase alphanumeric with underscores.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Responsibilities and purpose of this role..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {creatingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Create Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {deleteRoleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Confirm Delete Role
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete custom role <strong className="font-mono text-slate-800 dark:text-slate-200">"{deleteRoleTarget.role_name}"</strong>?
            </p>

            {deleteRoleError && (
              <p className="mt-2 text-xs text-rose-600 font-semibold">{deleteRoleError}</p>
            )}

            <div className="pt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteRoleTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                disabled={deletingRole}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {deletingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change User Role Modal */}
      {assignUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <span>Change User Role</span>
              </h3>
              <button
                type="button"
                onClick={() => setAssignUserModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <p className="font-bold text-slate-900 dark:text-slate-100">{assignUserModal.full_name}</p>
                <p className="text-[11px] text-slate-400">@{assignUserModal.username} · {assignUserModal.email}</p>
              </div>

              {assignRoleError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assignRoleError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Select Assigned Role
                </label>
                <select
                  value={selectedAssignRole}
                  onChange={(e) => setSelectedAssignRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.role_name}>
                      {r.role_name} {r.is_system ? '(System)' : '(Custom)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignUserModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveUserRole}
                  disabled={savingAssignRole}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {savingAssignRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Update Role</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};