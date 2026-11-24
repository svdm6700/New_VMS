import api, { uploadApi, API_BASE_URL } from './api';
import {
  DocumentItem,
  DocumentResult,
  DocumentSummary,
  DocumentDeletionPreview,
  PaginatedDocumentsResponse,
  ProcessOptions,
  VoterRecord,
  VoterRecordsResponse,
  VerifiedVoter
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
    uploaded_by?: number;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    order?: string;
    limit?: number;
    page?: number;
  }): Promise<DocumentItem[]> {
    const res = await api.get('/api/documents', { params });
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.documents)) return res.data.documents;
    return [];
  },

  async getDocumentsExtended(params?: {
    query?: string;
    status?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward_number?: string;
    uploaded_by?: number;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    order?: string;
    limit?: number;
    page?: number;
  }): Promise<PaginatedDocumentsResponse> {
    const res = await api.get('/api/documents', { params });
    if (Array.isArray(res.data)) {
      return {
        documents: res.data,
        total: res.data.length,
        page: 1,
        limit: res.data.length || 20,
        pages: 1,
        summary: {
          total_documents: res.data.length,
          completed_documents: res.data.filter((d: any) => d.status === 'completed').length,
          processing_documents: res.data.filter((d: any) => d.status === 'processing' || d.status === 'uploaded').length,
          failed_documents: res.data.filter((d: any) => d.status === 'failed').length,
          total_voters: res.data.reduce((acc: number, d: any) => acc + (d.extracted_voters || d.records_count || 0), 0),
          total_storage_bytes: res.data.reduce((acc: number, d: any) => acc + (d.file_size || 0), 0)
        }
      };
    }
    return res.data;
  },

  async getDocumentSummary(): Promise<DocumentSummary> {
    const res = await api.get('/api/documents/summary');
    return res.data;
  },

  async getDocument(id: string): Promise<DocumentResult & { metadata: { processing_status?: string } }> {
    const res = await api.get(`/api/documents/${id}`);
    return res.data;
  },

  getDocumentFileUrl(id: string): string {
    return `${API_BASE_URL}/api/documents/${id}/download`;
  },

  async downloadDocument(id: string, filename?: string): Promise<void> {
    const res = await api.get(`/api/documents/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `document-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async getDeletionPreview(id: string): Promise<DocumentDeletionPreview> {
    const res = await api.get(`/api/documents/${id}/deletion-preview`);
    return res.data;
  },

  async deleteDocument(id: string): Promise<{
    status: string;
    id: string;
    message: string;
    deleted_voters_count: number;
    cleaned_files: string[];
  }> {
    const res = await api.delete(`/api/documents/${id}`);
    return res.data;
  },

  async reprocessDocument(id: string): Promise<{ status: string; message: string; id: string }> {
    const res = await api.post(`/api/documents/${id}/reprocess`);
    return res.data;
  },

  async uploadPdf(file: File, options?: ProcessOptions): Promise<{ id: string; status: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.district_id !== undefined && options?.district_id !== null) {
      formData.append('district_id', String(options.district_id));
    }
    formData.append('district', options?.district || '');
    if (options?.constituency_id !== undefined && options?.constituency_id !== null) {
      formData.append('constituency_id', String(options.constituency_id));
    }
    formData.append('constituency', options?.constituency || '');
    formData.append('area', options?.area || '');
    if (options?.ward_id !== undefined && options?.ward_id !== null) {
      formData.append('ward_id', String(options.ward_id));
    }
    formData.append('ward_number', options?.ward_number || '');

    const res = await uploadApi.post('/api/documents/upload', formData, {
      timeout: 600000, // 10 minutes — handles large PDFs with 2,500+ voters
      params: {
        ollama_url: options?.ollamaUrl || (import.meta.env?.VITE_OLLAMA_URL as string) || '',
        model_name: options?.modelName || (import.meta.env?.VITE_OLLAMA_MODEL as string) || 'llama3.2',
        use_ai: options?.useAi ?? false,
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

  // Global voter records query
  async getVoterRecords(params?: {
    page?: number;
    limit?: number;
    document_id?: string;
    query?: string;
    search_unique_id?: string;
    gender?: string;
    district?: string;
    constituency?: string;
    area?: string;
    ward_number?: string;
    source_page?: number;
    image_matching_status?: string;
    sort_by?: string;
    order?: string;
  }): Promise<VoterRecordsResponse> {
    const res = await api.get('/api/voter-records', { params });
    return res.data;
  },

  async verifyVoterPhotoStatus(voterId: number, status: string, notes?: string): Promise<any> {
    const res = await api.put(`/api/voters/${voterId}/verify-photo`, { status, notes });
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

  // -------------------------------------------------------------
  // Voter List A4 PDF Generation (27 Voters per Page, 3x9 Grid)
  // Page-Wise, Memory-Efficient, Recoverable with Background Jobs
  // -------------------------------------------------------------
  async getIndividualVoterPdf(voterId: string | number): Promise<Blob> {
    const res = await api.get(`/api/voters/${voterId}/pdf`, { responseType: 'blob', timeout: 60000 });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async getSelectedVotersPdf(voterIds: (string | number)[]): Promise<Blob> {
    const res = await api.post('/api/voters/pdf/selected', { voter_ids: voterIds }, { responseType: 'blob', timeout: 180000 });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async getSinglePagePdf(params: {
    page_number: number;
    total_pages?: number;
    document_id?: string;
    voter_ids?: (string | number)[];
    panchayat?: string;
    constituency?: string;
    ward?: string;
    district?: string;
  }): Promise<Blob> {
    const res = await api.post('/api/voters/pdf/page', params, { responseType: 'blob', timeout: 30000 });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async getCompleteVoterListPdf(filters?: {
    district?: string;
    constituency?: string;
    ward_number?: string;
    area?: string;
    document_id?: string;
    query?: string;
    search_unique_id?: string;
    gender?: string;
    page?: number;
  }): Promise<Blob> {
    const res = await api.post('/api/voters/pdf/generate', filters || {}, { responseType: 'blob', timeout: 180000 });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async startPdfExportJob(payload: {
    title?: string;
    district?: string;
    constituency?: string;
    ward_number?: string;
    area?: string;
    document_id?: string;
    query?: string;
    search_unique_id?: string;
    gender?: string;
    voter_ids?: (string | number)[];
  }): Promise<any> {
    const res = await api.post('/api/voters/pdf/export-jobs', payload, { timeout: 30000 });
    return res.data;
  },

  async getPdfJobProgress(jobId: string): Promise<any> {
    const res = await api.get(`/api/voters/pdf/export-jobs/${jobId}`, { timeout: 15000 });
    return res.data;
  },

  async retryPdfJob(jobId: string): Promise<any> {
    const res = await api.post(`/api/voters/pdf/export-jobs/${jobId}/retry`, {}, { timeout: 15000 });
    return res.data;
  },

  async downloadPdfJobBlob(jobId: string): Promise<Blob> {
    const res = await api.get(`/api/voters/pdf/export-jobs/${jobId}/download`, { responseType: 'blob', timeout: 180000 });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  // -------------------------------------------------------------
  // Voter Verification API (Single-Screen User Access)
  // -------------------------------------------------------------
  async verifyVoter(uniqueCode: string): Promise<VerifiedVoter> {
    const cleanCode = (uniqueCode || '').trim().toUpperCase();
    const res = await api.get(`/api/voters/verify/${cleanCode}`);
    return res.data;
  },

  // -------------------------------------------------------------
  // Asynchronous Page-Wise Progress & Retry APIs
  // -------------------------------------------------------------
  async getDocumentProgress(docId: string): Promise<any> {
    const res = await api.get(`/api/documents/${docId}/progress`);
    return res.data;
  },

  async getDocumentPages(docId: string): Promise<any> {
    const res = await api.get(`/api/documents/${docId}/pages`);
    return res.data;
  },

  async getPageDetails(docId: string, pageNo: number): Promise<any> {
    const res = await api.get(`/api/documents/${docId}/pages/${pageNo}`);
    return res.data;
  },

  async retryPage(docId: string, pageNo: number): Promise<any> {
    const res = await api.post(`/api/documents/${docId}/pages/${pageNo}/retry`);
    return res.data;
  },

  async retryFailedPages(docId: string): Promise<any> {
    const res = await api.post(`/api/documents/${docId}/retry-failed`);
    return res.data;
  },

  // -------------------------------------------------------------
  // Voter Payment & Verification APIs
  // -------------------------------------------------------------

  async getVoterPaymentStatus(voterId: number): Promise<any> {
    const res = await api.get(`/api/voters/${voterId}/payment-status`);
    return res.data;
  },

  async submitVoterPayment(
    voterId: number,
    remarks?: string,
    idempotencyKey?: string
  ): Promise<any> {
    const res = await api.post(`/api/voters/${voterId}/submit-payment`, {
      remarks: remarks || '',
      idempotency_key: idempotencyKey,
    });
    return res.data;
  },

  async updateVoterRemarks(voterId: number, remarks: string): Promise<any> {
    const res = await api.patch(`/api/voters/${voterId}/remarks`, {
      remarks,
    });
    return res.data;
  },
};
