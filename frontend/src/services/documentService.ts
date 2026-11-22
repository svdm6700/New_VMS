import api, { API_BASE_URL } from './api';
import {
  DocumentItem,
  DocumentResult,
  ProcessOptions,
  VoterRecord,
  VoterRecordsResponse
} from '../types/document';

export const documentService = {
  async checkHealth(): Promise<{ status: string; database?: string; timestamp?: string }> {
    const res = await api.get('/api/health');
    return res.data;
  },

  async getDocuments(params?: {
    query?: string;
    status?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward_number?: string;
    sort_by?: string;
    order?: string;
    limit?: number;
    page?: number;
  }): Promise<DocumentItem[]> {
    const res = await api.get('/api/documents', { params });
    return res.data;
  },

  async getDocument(id: string): Promise<DocumentResult & { metadata: { processing_status?: string } }> {
    const res = await api.get(`/api/documents/${id}`);
    return res.data;
  },

  getDocumentFileUrl(id: string): string {
    return `${API_BASE_URL}/api/documents/${id}/file`;
  },

  async uploadPdf(file: File, options?: ProcessOptions): Promise<{ id: string; status: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('district', options?.district || '');
    formData.append('constituency', options?.constituency || '');
    formData.append('area', options?.area || '');
    formData.append('ward_number', options?.ward_number || '');

    const res = await api.post('/api/documents/upload', formData, {
      params: {
        ollama_url: options?.ollamaUrl || 'http://localhost:11434',
        model_name: options?.modelName || 'llama3.2',
        use_ai: options?.useAi ?? true,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && options?.onUploadProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onUploadProgress(percent);
        }
      },
    });
    return res.data;
  },

  // Alias for backward compatibility
  async processPdf(file: File, options?: ProcessOptions): Promise<any> {
    return this.uploadPdf(file, options);
  },

  async deleteDocument(id: string): Promise<{ status: string; id: string }> {
    const res = await api.delete(`/api/documents/${id}`);
    return res.data;
  },

  // Global voter records query
  async getVoterRecords(params?: {
    page?: number;
    limit?: number;
    document_id?: string;
    query?: string;
    gender?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward_number?: string;
    source_page?: number;
    sort_by?: string;
    order?: string;
  }): Promise<VoterRecordsResponse> {
    const res = await api.get('/api/voter-records', { params });
    return res.data;
  },

  // Document-specific voter records query
  async getDocumentRecords(docId: string, params?: {
    page?: number;
    limit?: number;
    query?: string;
    gender?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward_number?: string;
    source_page?: number;
    sort_by?: string;
    order?: string;
  }): Promise<VoterRecordsResponse> {
    const res = await api.get(`/api/documents/${docId}/records`, { params });
    return res.data;
  },

  async getVoterRecord(id: number): Promise<VoterRecord> {
    const res = await api.get(`/api/voter-records/${id}`);
    return res.data;
  },

  async updateVoterRecord(id: number, data: Partial<VoterRecord>): Promise<VoterRecord> {
    const res = await api.put(`/api/voter-records/${id}`, data);
    return res.data;
  },

  async deleteVoterRecord(id: number): Promise<{ status: string; id: number }> {
    const res = await api.delete(`/api/voter-records/${id}`);
    return res.data;
  },

  async exportDocumentExcel(docId: string): Promise<Blob> {
    const res = await api.get(`/api/documents/${docId}/export`, {
      params: { format: 'excel' },
      responseType: 'blob'
    });
    return new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  },

  async exportDocumentCsv(docId: string): Promise<Blob> {
    const res = await api.get(`/api/documents/${docId}/export`, {
      params: { format: 'csv' },
      responseType: 'blob'
    });
    return new Blob([res.data], {
      type: 'text/csv;charset=utf-8;'
    });
  },

  async exportExcel(result: DocumentResult): Promise<Blob> {
    const res = await api.post('/api/documents/export', { result }, { responseType: 'blob' });
    return new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  },
};
