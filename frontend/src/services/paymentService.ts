import api from './api';

export interface PaymentSummary {
  total_transactions: number;
  total_amount: number;
  total_amount_recorded: number;
  total_payments: number;
  paid_amount: number;
  pending_amount: number;
  failed_transactions: number;
  failed_amount: number;
  refunded_amount: number;
  cancelled_amount: number;
  today_collection: number;
  yesterday_collection: number;
  this_month_collection: number;
  last_month_collection: number;
  paid_percentage: number;
  pending_percentage: number;
  today_growth_pct: number;
  month_growth_pct: number;
}

export interface PaymentAuditLog {
  id: number;
  payment_id: number;
  action: string;
  old_values?: any;
  new_values?: any;
  reason?: string;
  performed_by?: number;
  performer_name?: string;
  performer_username?: string;
  performed_at: string;
}

export interface PaymentRecord {
  id: number;
  transaction_id: string;
  receipt_number: string;
  voter_id: number;
  voter_entry_id?: number;
  voter_name: string;
  epic_no: string;
  relation_name: string;
  relation_type?: string;
  age?: string;
  gender?: string;
  house_no: string;
  district: string;
  constituency: string;
  area: string;
  ward_number: string;
  mobile_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  transaction_reference?: string;
  remarks: string;
  created_by?: number;
  creator_name?: string;
  creator_username?: string;
  updated_by?: number;
  updater_name?: string;
  verified_by?: number;
  verifier_name?: string;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
  audit_logs?: PaymentAuditLog[];
}

export interface PaymentsResponse {
  payments: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  filtered_summary: {
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    count: number;
  };
}

export interface CreatePaymentPayload {
  voter_id: number;
  voter_entry_id?: number;
  mobile_number: string;
  amount: number;
  payment_date?: string;
  payment_method: string;
  payment_status: string;
  transaction_reference?: string;
  remarks?: string;
}

export interface UpdatePaymentPayload {
  mobile_number?: string;
  amount?: number;
  payment_date?: string;
  payment_method?: string;
  transaction_reference?: string;
  remarks?: string;
}

export interface DailyCollectionPoint {
  date: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
}

export interface MonthlyCollectionPoint {
  month: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
}

export interface StatusDistributionPoint {
  status: string;
  count: number;
  total_amount: number;
  percentage: number;
}

export interface MethodDistributionPoint {
  method: string;
  count: number;
  total_amount: number;
  percentage: number;
}

export interface LocationCollectionData {
  districts: {
    district: string;
    count: number;
    total_amount: number;
    paid_amount: number;
  }[];
  constituencies: {
    constituency: string;
    count: number;
    total_amount: number;
    paid_amount: number;
  }[];
}

export interface PaymentReceipt {
  receipt_number: string;
  transaction_id: string;
  receipt_title: string;
  watermark: string;
  is_paid: boolean;
  payment_status: string;
  payment_date: string;
  issued_at: string;
  amount: number;
  amount_formatted: string;
  amount_in_words: string;
  payment_method: string;
  transaction_reference: string;
  remarks: string;
  voter: {
    id: number;
    voter_name: string;
    epic_no: string;
    relation_name: string;
    relation_type: string;
    age: string;
    gender: string;
    house_no: string;
    serial_no: string;
    mobile_number: string;
    district: string;
    constituency: string;
    area: string;
    ward_number: string;
  };
  creator: {
    name: string;
    username: string;
  };
  verifier: {
    name?: string;
    username?: string;
    verified_at?: string;
  };
  organization: {
    name: string;
    telugu_name: string;
    tagline: string;
    jurisdiction: string;
  };
  disclaimer: string;
}

export interface VoterPaymentHistoryResponse {
  voter: any;
  summary: {
    total_paid: number;
    total_pending: number;
    total_refunded: number;
    total_entered_amount: number;
    payments_count: number;
    entries_count: number;
  };
  payments: PaymentRecord[];
  entries: any[];
}

export const paymentService = {
  async getSummary(): Promise<PaymentSummary> {
    const res = await api.get('/api/payments/dashboard/summary');
    return res.data;
  },

  async getDailyCollection(days = 30, fromDate?: string, toDate?: string): Promise<DailyCollectionPoint[]> {
    const res = await api.get('/api/payments/dashboard/daily-collection', {
      params: { days, from_date: fromDate, to_date: toDate },
    });
    return res.data;
  },

  async getMonthlyCollection(months = 12): Promise<MonthlyCollectionPoint[]> {
    const res = await api.get('/api/payments/dashboard/monthly-collection', {
      params: { months },
    });
    return res.data;
  },

  async getStatusDistribution(): Promise<StatusDistributionPoint[]> {
    const res = await api.get('/api/payments/dashboard/status-distribution');
    return res.data;
  },

  async getMethodDistribution(): Promise<MethodDistributionPoint[]> {
    const res = await api.get('/api/payments/dashboard/method-distribution');
    return res.data;
  },

  async getLocationCollection(): Promise<LocationCollectionData> {
    const res = await api.get('/api/payments/dashboard/location-collection');
    return res.data;
  },

  async listPayments(params: {
    q?: string;
    from_date?: string;
    to_date?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward?: string;
    payment_status?: string;
    payment_method?: string;
    created_by?: number;
    sort_by?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<PaymentsResponse> {
    const res = await api.get('/api/payments', { params });
    return res.data;
  },

  async createPayment(payload: CreatePaymentPayload): Promise<{ status: string; message: string; payment: PaymentRecord }> {
    const res = await api.post('/api/payments', payload);
    return res.data;
  },

  async getPayment(id: number): Promise<PaymentRecord> {
    const res = await api.get(`/api/payments/${id}`);
    return res.data;
  },

  async updatePayment(id: number, payload: UpdatePaymentPayload): Promise<{ status: string; message: string; payment: PaymentRecord }> {
    const res = await api.put(`/api/payments/${id}`, payload);
    return res.data;
  },

  async verifyPayment(id: number): Promise<{ status: string; message: string; payment: PaymentRecord }> {
    const res = await api.post(`/api/payments/${id}/verify`, {});
    return res.data;
  },

  async cancelPayment(id: number, reason: string): Promise<{ status: string; message: string; payment: PaymentRecord }> {
    const res = await api.post(`/api/payments/${id}/cancel`, { reason });
    return res.data;
  },

  async refundPayment(id: number, reason: string): Promise<{ status: string; message: string; payment: PaymentRecord }> {
    const res = await api.post(`/api/payments/${id}/refund`, { reason });
    return res.data;
  },

  async deletePayment(id: number): Promise<{ status: string; message: string; id: number }> {
    const res = await api.delete(`/api/payments/${id}`);
    return res.data;
  },

  async getReceipt(id: number): Promise<PaymentReceipt> {
    const res = await api.get(`/api/payments/${id}/receipt`);
    return res.data;
  },

  async searchVoters(q: string, limit = 20): Promise<any[]> {
    const res = await api.get('/api/payments/voters/search', { params: { q, limit } });
    return res.data;
  },

  async getVoterHistory(voterId: number): Promise<VoterPaymentHistoryResponse> {
    const res = await api.get(`/api/payments/voters/${voterId}/history`);
    return res.data;
  },

  async downloadExport(format: 'csv' | 'excel', params: Record<string, any> = {}): Promise<void> {
    const res = await api.get('/api/payments/export', {
      params: { ...params, format },
      responseType: 'blob',
    });

    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const blob = new Blob([res.data], {
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vms_payments_export_${new Date().toISOString().slice(0, 10)}.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
