import api from './api';
import {
  Wallet,
  WalletTransaction,
  UserWalletSummary,
  GeographicAssignment,
  VoterAmountAllocation,
  WalletGlobalSummary
} from '../types/wallet';

export const walletService = {
  // Admin Wallet
  async getAdminWallet(): Promise<{
    wallet: Wallet;
    available_balance: number;
    total_amount_added: number;
    total_allocated_to_users: number;
    total_spent_by_users: number;
    total_refunds: number;
    recent_transactions: WalletTransaction[];
  }> {
    const res = await api.get('/api/admin/wallet');
    return res.data;
  },

  async fundAdminWallet(data: {
    amount: number;
    payment_method?: string;
    transaction_reference?: string;
    funding_source?: string;
    remarks?: string;
  }): Promise<{ status: string; message: string; wallet: Wallet; transaction: WalletTransaction }> {
    const res = await api.post('/api/admin/wallet/fund', data);
    return res.data;
  },

  async getAdminWalletTransactions(params?: {
    page?: number;
    limit?: number;
    direction?: string;
    transaction_type?: string;
    search?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<{ items: WalletTransaction[]; total: number; page: number; limit: number }> {
    const res = await api.get('/api/admin/wallet/transactions', { params });
    return res.data;
  },

  // User Wallet Management (Admin View)
  async getUserWallets(): Promise<UserWalletSummary[]> {
    const res = await api.get('/api/admin/wallet/users');
    return res.data;
  },

  async allocateToUser(data: {
    user_id: number;
    amount: number;
    remarks?: string;
    idempotency_key?: string;
  }): Promise<{
    status: string;
    message: string;
    admin_balance: number;
    user_balance: number;
    admin_transaction_id: string;
    user_transaction_id: string;
  }> {
    const res = await api.post('/api/admin/wallet/allocate', data);
    return res.data;
  },

  async getUserWalletTransactions(
    userId: number,
    params?: { page?: number; limit?: number }
  ): Promise<{ items: WalletTransaction[]; total: number; page: number; limit: number }> {
    const res = await api.get(`/api/admin/wallet/users/${userId}/transactions`, { params });
    return res.data;
  },

  // Geographic Assignments
  async getUserAssignments(params?: {
    user_id?: number;
    constituency?: string;
    status?: string;
  }): Promise<GeographicAssignment[]> {
    const res = await api.get('/api/admin/user-assignments', { params });
    return res.data;
  },

  async createAssignment(data: {
    user_id: number;
    district: string;
    constituency: string;
    wards: string[];
    area?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<GeographicAssignment> {
    const res = await api.post('/api/admin/user-assignments', data);
    return res.data;
  },

  async updateAssignment(
    id: number,
    data: {
      district?: string;
      constituency?: string;
      wards?: string[];
      area?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    }
  ): Promise<GeographicAssignment> {
    const res = await api.put(`/api/admin/user-assignments/${id}`, data);
    return res.data;
  },

  async deleteAssignment(id: number): Promise<{ status: string; message: string }> {
    const res = await api.delete(`/api/admin/user-assignments/${id}`);
    return res.data;
  },

  async getLocations(): Promise<{ districts: string[]; constituencies: string[]; wards: string[] }> {
    const res = await api.get('/api/admin/locations');
    return res.data;
  },

  // User's Own Wallet
  async getMyWallet(): Promise<{
    wallet: Wallet;
    available_balance: number;
    total_amount_allocated: number;
    total_amount_spent: number;
    total_amount_refunded: number;
    recent_transactions: WalletTransaction[];
    geographic_assignments: GeographicAssignment[];
  }> {
    const res = await api.get('/api/user/wallet');
    return res.data;
  },

  async getMyWalletTransactions(params?: {
    page?: number;
    limit?: number;
    direction?: string;
    transaction_type?: string;
  }): Promise<{ items: WalletTransaction[]; total: number; page: number; limit: number }> {
    const res = await api.get('/api/user/wallet/transactions', { params });
    return res.data;
  },

  // Assigned Voters & Amount Allocation (User Scope)
  async getMyAssignedVoters(params?: {
    page?: number;
    limit?: number;
    search?: string;
    ward?: string;
    gender?: string;
  }): Promise<{ items: any[]; total: number; page: number; limit: number; message?: string }> {
    const res = await api.get('/api/user/assigned-voters', { params });
    return res.data;
  },

  async getMyAssignedVoterDetails(voterId: number): Promise<any> {
    const res = await api.get(`/api/user/assigned-voters/${voterId}`);
    return res.data;
  },

  async assignVoterAmount(data: {
    voter_id: number;
    amount: number;
    remarks?: string;
    idempotency_key?: string;
  }): Promise<{
    status: string;
    message: string;
    allocation: VoterAmountAllocation;
    updated_balance: number;
    transaction_id: string;
  }> {
    const res = await api.post('/api/user/voter-allocations', data);
    return res.data;
  },

  async getMyVoterAllocations(params?: {
    page?: number;
    limit?: number;
    search?: string;
    ward?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<{ items: VoterAmountAllocation[]; total: number; page: number; limit: number }> {
    const res = await api.get('/api/user/voter-allocations', { params });
    return res.data;
  },

  async reverseVoterAllocation(
    allocationId: number,
    reason: string
  ): Promise<{ status: string; message: string; updated_balance: number; transaction_id: string }> {
    const res = await api.post(`/api/user/voter-allocations/${allocationId}/reverse`, { reason });
    return res.data;
  },

  // Admin Reports
  async getAllVoterAllocations(params?: {
    page?: number;
    limit?: number;
    user_id?: number;
    constituency?: string;
    ward?: string;
    status?: string;
    search?: string;
  }): Promise<{ items: VoterAmountAllocation[]; total: number; page: number; limit: number }> {
    const res = await api.get('/api/admin/voter-allocations', { params });
    return res.data;
  },

  async getGlobalSummary(): Promise<WalletGlobalSummary> {
    const res = await api.get('/api/admin/wallet/summary');
    return res.data;
  }
};
