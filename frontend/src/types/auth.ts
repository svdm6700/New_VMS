export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  last_login?: string | null;
}

export interface LoginCredentials {
  username_or_email: string;
  password: string;
  remember_me?: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface CreateUserPayload {
  full_name: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  username?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface UserFilterParams {
  query?: string;
  role?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
