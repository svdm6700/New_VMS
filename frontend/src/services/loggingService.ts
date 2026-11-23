/**
 * Centralized Frontend Structured Logging Service
 * Sends client-side events, exceptions, API failures, and user actions to the backend logger.
 * Redacts sensitive fields (passwords, tokens).
 */

function getApiBaseUrl(): string {
  const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:8000';
  return String(rawBase).replace(/\/api\/?$/, '');
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
