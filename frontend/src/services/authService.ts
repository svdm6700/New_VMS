import api, {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY
} from './api';
import {
  User,
  LoginCredentials,
  AuthResponse,
  CreateUserPayload,
  UpdateUserPayload,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  UserFilterParams,
  UserListResponse
} from '../types/auth';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/auth/login', credentials);
    const data = res.data;
    if (data.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refresh_token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  },

  async getMe(): Promise<User> {
    const res = await api.get<User>('/api/auth/me');
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data));
    return res.data;
  },

  async changePassword(data: ChangePasswordPayload): Promise<{ status: string; message?: string }> {
    const res = await api.post('/api/auth/change-password', data);
    return res.data;
  },

  async forgotPassword(data: ForgotPasswordPayload): Promise<{ status: string; message: string; reset_token?: string }> {
    const res = await api.post('/api/auth/forgot-password', data);
    return res.data;
  },

  async resetPassword(data: ResetPasswordPayload): Promise<{ status: string; message?: string }> {
    const res = await api.post('/api/auth/reset-password', data);
    return res.data;
  },

  // -------------------------------------------------------------
  // Admin User Management Services
  // -------------------------------------------------------------
  async getUsers(params?: UserFilterParams): Promise<UserListResponse> {
    const res = await api.get<UserListResponse>('/api/admin/users', { params });
    return res.data;
  },

  async getUser(id: number): Promise<User> {
    const res = await api.get<User>(`/api/admin/users/${id}`);
    return res.data;
  },

  async createUser(data: CreateUserPayload): Promise<User> {
    const res = await api.post<User>('/api/admin/users', data);
    return res.data;
  },

  async updateUser(id: number, data: UpdateUserPayload): Promise<User> {
    const res = await api.put<User>(`/api/admin/users/${id}`, data);
    return res.data;
  },

  async toggleUserStatus(id: number, is_active: boolean): Promise<User> {
    const res = await api.patch<User>(`/api/admin/users/${id}/status`, { is_active });
    return res.data;
  },

  async changeUserRole(id: number, role: string): Promise<User> {
    const res = await api.patch<User>(`/api/admin/users/${id}/role`, { role });
    return res.data;
  },

  async deleteUser(id: number): Promise<{ status: string; user_id: number }> {
    const res = await api.delete(`/api/admin/users/${id}`);
    return res.data;
  },
};
