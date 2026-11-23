import axios from 'axios';
import { logger } from './loggingService';

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = rawBase.replace(/\/api\/?$/, '');

export const TOKEN_STORAGE_KEY = 'vms_auth_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'vms_refresh_token';
export const USER_STORAGE_KEY = 'vms_user';

// Helper to get token with backward compatibility for existing sessions
export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem('telugu_pdf_auth_token');
};

export const getStoredRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || localStorage.getItem('telugu_pdf_refresh_token');
};

export const clearStoredAuth = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('telugu_pdf_auth_token');
  localStorage.removeItem('telugu_pdf_refresh_token');
  localStorage.removeItem('telugu_pdf_user');
};

const defaultTimeout = Number(import.meta.env.VITE_API_TIMEOUT) || 30000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: defaultTimeout,
});

// Longer timeout instance for file uploads (2,500+ voters / large PDFs)
export const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes
});

// Request interceptor: Automatically attach JWT Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Same auth interceptor for the upload instance
uploadApi.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Extract clean error message and handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    let message = 'An unexpected error occurred.';

    if (!error.response) {
      message = `Network Error: Unable to connect to server at ${API_BASE_URL}. Please ensure the FastAPI backend is running.`;
    } else if (error.response.status === 401) {
      // If 401 occurs on a protected route (and not on login), clear stored session if refresh fails
      const originalRequest = error.config;
      if (!originalRequest.url?.includes('/api/auth/login')) {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        if (refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
              refresh_token: refreshToken,
            });
            const newToken = refreshRes.data.access_token;
            localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (refreshErr) {
            clearStoredAuth();
            window.dispatchEvent(new Event('auth:unauthorized'));
          }
        } else {
          clearStoredAuth();
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }
      message = error.response.data?.detail || 'Authentication required or session expired.';
    } else if (error.response?.data?.detail) {
      if (typeof error.response.data.detail === 'string') {
        message = error.response.data.detail;
      } else if (Array.isArray(error.response.data.detail)) {
        message = error.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else {
        message = JSON.stringify(error.response.data.detail);
      }
    } else if (error.message) {
      message = error.message;
    }

    if (!error.config?.url?.includes('/api/logs/frontend')) {
      logger.error(`API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} [${error.response?.status || 'Network Error'}] - ${message}`, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        error_message: message,
      });
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
