export interface DocumentSummary {
  total_documents: number;
  completed_documents: number;
  processing_documents: number;
  failed_documents: number;
  total_voters: number;
  total_storage_bytes: number;
}

export interface DocumentDeletionPreview {
  document_id: string;
  document_name: string;
  file_size: number;
  district?: string;
  constituency?: string;
  voters_count: number;
  exclusive_voters_count: number;
  shared_voters_count: number;
  processing_records_count: number;
  payments_count: number;
  voter_entries_count: number;
  warning: string;
  can_delete: boolean;
}

export interface PaginatedDocumentsResponse {
  documents: DocumentItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: DocumentSummary;
}

export interface DocumentItem {
  id: string;
  document_id?: string;
  filename: string;
  document_name?: string;
  original_filename?: string;
  stored_file_path?: string;
  file_size: number;
  file_type?: string;
  total_pages?: number;
  page_count: number;
  text_pages?: number;
  ocr_pages?: number;
  extracted_voters?: number;
  records_count?: number;
  processing_type?: string;
  status: 'completed' | 'processing' | 'failed' | 'uploaded' | 'pending';
  processing_status?: 'completed' | 'processing' | 'failed' | 'uploaded' | 'pending';
  created_at: string;
  uploaded_at?: string;
  processed_at?: string | null;
  error?: string;
  processing_error?: string | null;
  use_ai?: boolean;
  uploaded_by?: number | null;
  uploader_name?: string;
  file_exists_on_disk?: boolean;

  // Manual Location Details
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
}

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
  unique_id?: string;
  source_page: number;
  ocr_confidence?: number | null;
  photo_path?: string | null;
  photo_url?: string | null;
  has_photo?: boolean;
  image_matching_status?: 'MATCHED' | 'MISSING' | 'NEEDS_VERIFICATION' | 'EXTRACTION_FAILED' | string;
  block_bbox?: string | null;
  photo_bbox?: string | null;
  created_at: string;
  updated_at: string;

  // Associated Document Location Details
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
}

export interface DocumentPageItem {
  id: number;
  document_id: string;
  page_number: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  retry_count: number;
  max_retries: number;
  voter_count: number;
  error_details?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface DocumentProgress {
  document_id: string;
  status: string;
  total_pages: number;
  processed_pages: number;
  failed_pages: number;
  total_voters: number;
  percent_complete: number;
  pages: DocumentPageItem[];
}

export interface VerifiedVoter {
  status: string;
  id?: number;
  voter_db_id?: number;
  unique_code: string;
  unique_key: string;
  voter_name: string;
  epic_number: string;
  voter_id: string;
  relation_type: string;
  relation_name: string;
  father_or_husband_name: string;
  age: string;
  gender: string;
  house_number: string;
  house_no: string;
  district?: string;
  constituency?: string;
  ward?: string;
  ward_number?: string;
  part_number?: string;
  electoral_roll_no?: string;
  serial_no?: string;
  area?: string;
  has_photo: boolean;
  photo_url?: string;
  photo_base64?: string;
  is_paid?: boolean;
  payment_status?: string;
  applicable_amount?: number;
  user_wallet_balance?: number;
  amount?: number;
  deducted_amount?: number;
  transaction_id?: string;
  transaction_date?: string;
  remarks?: string;
  paid_by?: string;
}

export interface VoterPaymentStatus {
  voter_id: number;
  unique_code?: string;
  is_paid: boolean;
  payment_status: 'PAID' | 'UNPAID';
  applicable_amount: number;
  user_wallet_balance: number;
  amount: number;
  deducted_amount?: number;
  transaction_id?: string;
  transaction_date?: string;
  remarks?: string;
  paid_by?: string;
}

export interface SubmitPaymentResponse {
  status: string;
  message: string;
  is_paid: boolean;
  payment_status: string;
  amount: number;
  deducted_amount: number;
  transaction_id: string;
  transaction_date: string;
  wallet_balance: number;
  updated_balance: number;
  remarks?: string;
}

export interface VoterRecordsResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  document_id?: string;
  document_name?: string;
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
  records: VoterRecord[];
}

export interface PageItem {
  page: number;
  method: string;
  text: string;
}

export interface ParagraphItem {
  Page: number;
  "Heading (Telugu)"?: string;
  "Heading (English)"?: string;
  "Telugu paragraph"?: string;
  "English translation"?: string;
}

export interface TableRowTe {
  Page: number;
  Table: string;
  Row: number;
  "Telugu / Original": string;
  English: string;
}

export interface TableRowEn {
  Page: number;
  Table: string;
  Row: number;
  "English / Translation": string;
}

export interface ValidationInfo {
  expected_pages: number;
  processed_pages: number;
  pages_without_text: number[];
  review_notes: string[];
}

export interface DocumentMetadata {
  filename: string;
  page_count: number;
  text_pages?: number;
  ocr_pages?: number;
  records_count?: number;
  processing_status?: string;
  processing_error?: string | null;

  // Location fields
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
}

export interface ExtractedField {
  field_name: string;
  value: string;
}

export interface ExtractedRecord {
  record_id: number;
  page: number;
  title?: string;
  fields: ExtractedField[];
  serial_no?: string;
  voter_id?: string;
  voter_name?: string;
  relation_type?: string;
  relation_name?: string;
  house_no?: string;
  age?: string;
  gender?: string;
  block_bbox?: string | null;
  photo_bbox?: string | null;
  photo_path?: string | null;
  image_matching_status?: string | null;
}

export interface DocumentResult {
  id?: string;
  metadata: DocumentMetadata;
  pages: PageItem[];
  table_rows_te: TableRowTe[];
  table_rows_en: TableRowEn[];
  paragraphs: ParagraphItem[];
  records?: ExtractedRecord[];
  validation: ValidationInfo;

  // Location fields
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
}

export interface ProcessOptions {
  district?: string;
  constituency?: string;
  area?: string;
  ward_number?: string;
  ollamaUrl?: string;
  modelName?: string;
  useAi?: boolean;
  onUploadProgress?: (progress: number) => void;
}
