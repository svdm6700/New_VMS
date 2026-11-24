/**
 * Centralized Frontend Structured Logging Service
 * Sends client-side events, exceptions, API failures, and user actions to the backend logger.
 * Redacts sensitive fields (passwords, tokens).
 */

function getApiBaseUrl(): string {
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
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface FrontendLogPayload {
  level: LogLevel;
  message: string;
  url?: string;
  component?: string;
  action?: string;
  error_name?: string;
  error_message?: string;
  stack_trace?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  [key: string]: any;
}

const SENSITIVE_KEYS = ['password', 'token', 'access_token', 'refresh_token', 'secret', 'authorization'];

function redactObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      clean[k] = redactObject(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

class LoggingService {
  private queue: FrontendLogPayload[] = [];
  private flushTimeout: any = null;

  private get endpoint(): string {
    return `${getApiBaseUrl()}/api/logs/frontend`;
  }

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Window error handler
    window.addEventListener('error', (event) => {
      this.error(`Uncaught JS Exception: ${event.message}`, {
        url: window.location.href,
        component: 'Window',
        error_name: event.error?.name || 'Error',
        error_message: event.message,
        stack_trace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.error(`Unhandled Promise Rejection: ${reason?.message || String(reason)}`, {
        url: window.location.href,
        component: 'Promise',
        error_name: reason?.name || 'UnhandledRejection',
        error_message: reason?.message || String(reason),
        stack_trace: reason?.stack,
      });
    });
  }

  public log(level: LogLevel, message: string, meta?: Partial<FrontendLogPayload>) {
    const payload: FrontendLogPayload = {
      level,
      message,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
      ...redactObject(meta || {}),
    };

    // Log to browser console in dev mode
    if (import.meta.env?.DEV) {
      const prefix = `[VMS ${level}]`;
      if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(prefix, message, meta);
      } else if (level === 'WARN') {
        console.warn(prefix, message, meta);
      } else {
        console.log(prefix, message, meta);
      }
    }

    this.queue.push(payload);
    this.scheduleFlush();
  }

  public info(message: string, meta?: Partial<FrontendLogPayload>) {
    this.log('INFO', message, meta);
  }

  public warn(message: string, meta?: Partial<FrontendLogPayload>) {
    this.log('WARN', message, meta);
  }

  public error(message: string, meta?: Partial<FrontendLogPayload>) {
    this.log('ERROR', message, meta);
  }

  private scheduleFlush() {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      this.flush();
    }, 1500);
  }

  public async flush() {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    try {
      const token = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('vms_auth_token') || localStorage.getItem('token') || localStorage.getItem('telugu_pdf_auth_token'))
        : null;
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ logs: batch }),
      });
    } catch {
      // Silently fail if server is unreachable to avoid cascading logging errors
    }
  }
}

export const logger = new LoggingService();
