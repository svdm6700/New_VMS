import api from './api';

export interface VoterRecord {
  id: number;
  document_id: string;
  serial_no: string;
  electoral_roll_no: string;
  voter_name: string;
  relation_type: string;
  relation_name: string;
  age: string;
  gender: string;
  house_no: string;
  voter_id: string;
  unique_key?: string;
  unique_code?: string;
  source_page?: number;
  ocr_confidence?: number;
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
  entries_count?: number;
  latest_mobile?: string | null;
  total_amount?: number;
  entries?: VoterEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface VoterEntry {
  id: number;
  voter_id: number;
  mobile_number?: string;
  amount: number;
  entry_date: string;
  remarks: string;
  created_by?: number;
  creator_name?: string;
  creator_username?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SearchVotersResponse {
  voters: VoterRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface VoterEntriesResponse {
  voter_id: number;
  voter_name: string;
  epic_no: string;
  total_entries: number;
  total_amount: number;
  entries: VoterEntry[];
}

export interface CreateEntryPayload {
  voter_id: number;
  mobile_number?: string;
  amount: number;
  entry_date?: string;
  remarks?: string;
}

export interface UpdateEntryPayload {
  mobile_number?: string;
  amount?: number;
  entry_date?: string;
  remarks?: string;
}

export const voterEntryService = {
  async searchVoters(params: {
    q?: string;
    page?: number;
    limit?: number;
    district?: string;
    constituency?: string;
    area?: string;
  }): Promise<SearchVotersResponse> {
    const res = await api.get('/api/voters/search', { params });
    return res.data;
  },

  async getVoterDetails(voterId: string | number): Promise<VoterRecord> {
    const res = await api.get(`/api/voters/${voterId}`);
    return res.data;
  },

  async getVoterEntries(voterId: string | number): Promise<VoterEntriesResponse> {
    const res = await api.get(`/api/voters/${voterId}/entries`);
    return res.data;
  },

  async createEntry(payload: CreateEntryPayload): Promise<{ status: string; message: string; entry: VoterEntry }> {
    const res = await api.post('/api/voter-entries', payload);
    return res.data;
  },

  async updateEntry(entryId: number, payload: UpdateEntryPayload): Promise<{ status: string; message: string; entry: VoterEntry }> {
    const res = await api.put(`/api/voter-entries/${entryId}`, payload);
    return res.data;
  },

  async deleteEntry(entryId: number): Promise<{ status: string; message: string; id: number }> {
    const res = await api.delete(`/api/voter-entries/${entryId}`);
    return res.data;
  },
};
