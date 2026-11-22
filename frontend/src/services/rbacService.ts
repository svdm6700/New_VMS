import api from './api';

export interface Permission {
  id: number;
  code: string;
  module: string;
  action: string;
  description?: string;
}

export interface Role {
  id: number;
  role_name: string;
  description?: string;
  is_system: boolean;
  users_count: number;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface RbacUser {
  id: number;
  full_name: string;
  email: string;
  username: string;
  role: string;
  roles: string[];
  is_active: boolean;
  effective_permissions: string[];
  created_at?: string;
  last_login?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export const rbacService = {
  async listRoles(): Promise<Role[]> {
    const res = await api.get('/api/rbac/roles');
    return res.data;
  },

  async createRole(data: { role_name: string; description?: string; permission_codes: string[] }): Promise<{ status: string; message: string; role: Role }> {
    const res = await api.post('/api/rbac/roles', data);
    return res.data;
  },

  async updateRole(roleId: number, data: { description?: string; permission_codes?: string[] }): Promise<{ status: string; message: string; role: Role }> {
    const res = await api.put(`/api/rbac/roles/${roleId}`, data);
    return res.data;
  },

  async deleteRole(roleId: number): Promise<{ status: string; message: string; id: number }> {
    const res = await api.delete(`/api/rbac/roles/${roleId}`);
    return res.data;
  },

  async listPermissions(): Promise<{ permissions: Permission[]; grouped: Record<string, Permission[]> }> {
    const res = await api.get('/api/rbac/permissions');
    return res.data;
  },

  async listUsers(): Promise<RbacUser[]> {
    const res = await api.get('/api/rbac/users');
    return res.data;
  },

  async assignUserRole(userId: number, roleName: string): Promise<{ status: string; message: string; user: RbacUser }> {
    const res = await api.post(`/api/rbac/users/${userId}/roles`, { role_name: roleName });
    return res.data;
  },

  async getMyPermissions(): Promise<{ user_id: number; username: string; role: string; is_admin: boolean; permissions: string[] }> {
    const res = await api.get('/api/rbac/my-permissions');
    return res.data;
  },

  async getAuditLogs(limit = 50): Promise<AuditLog[]> {
    const res = await api.get('/api/rbac/audit-logs', { params: { limit } });
    return res.data;
  },
};
