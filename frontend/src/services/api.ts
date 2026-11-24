import axios from 'axios';
import { logger } from './loggingService';

/**
 * Dynamically resolves the API base URL:
 * 1. window.__API_BASE_URL__ (runtime container / Nginx injection)
 * 2. VITE_API_BASE_URL or VITE_API_URL environment variable
 * 3. In dev mode (Vite port 5173 / dev server): connects to backend host + VITE_BACKEND_PORT
 * 4. In production: uses current origin (window.location.origin)
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }
  const envUrl = typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL);
  if (envUrl && String(envUrl).trim()) {
    return String(envUrl).trim().replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const isDev = Boolean(import.meta.env?.DEV) || window.location.port === '5173';
    if (isDev) {
      const proto = window.location.protocol || 'http:';
      const hostname = window.location.hostname || 'localhost';
      const port = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_PORT) || '8000';
      return `${proto}//${hostname}:${port}`;
    }
    return window.location.origin;
  }
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

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

// Generous default timeout for large data sets / PDF exports
const defaultTimeout = Number(import.meta.env.VITE_API_TIMEOUT) || 60000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: defaultTimeout,
});

// Longer timeout instance for file uploads & large bulk processing (2,500+ voters)
export const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes
});

// Request interceptor: Automatically attach JWT Bearer token if present
api.interceptors.request.use(
  (config) => {
    // Ensure base URL reflects any runtime dynamic setting
    config.baseURL = getApiBaseUrl();
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
    config.baseURL = getApiBaseUrl();
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
    const currentBase = getApiBaseUrl();
    let message = 'An unexpected error occurred.';

    // Safely extract error data even when responseType: 'blob' was requested (PDF exports)
    let respData = error.response?.data;
    if (typeof window !== 'undefined' && respData instanceof Blob) {
      try {
        const text = await respData.text();
        respData = JSON.parse(text);
      } catch {
        // Response blob is raw binary and not JSON text
      }
    }

    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      message = `Request Timeout: The server took longer than expected to generate the response (${Math.round((error.config?.timeout || defaultTimeout) / 1000)}s). For large datasets, please use page-wise generation or click Try Again.`;
    } else if (!error.response) {
      message = `Network Error: Unable to reach server at ${currentBase || 'backend'}. Please ensure the FastAPI backend is running and network connectivity is active.`;
    } else if (error.response.status === 401) {
      // If 401 occurs on a protected route (and not on login), clear stored session if refresh fails
      const originalRequest = error.config;
      if (!originalRequest.url?.includes('/api/auth/login')) {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        if (refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshRes = await axios.post(`${currentBase}/api/auth/refresh`, {
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
      message = (respData && respData.detail) || 'Authentication required or session expired.';
    } else if (respData?.detail) {
      if (typeof respData.detail === 'string') {
        message = respData.detail;
      } else if (Array.isArray(respData.detail)) {
        message = respData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof respData.detail === 'object') {
        message = respData.detail.message || respData.detail.error || JSON.stringify(respData.detail);
      } else {
        message = JSON.stringify(respData.detail);
      }
    } else if (respData?.message) {
      message = String(respData.message);
    } else if (respData?.error) {
      message = String(respData.error);
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
