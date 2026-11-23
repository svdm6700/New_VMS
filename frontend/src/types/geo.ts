export interface GeographicAssignment {
  id: number;
  user_id: number;
  user_username?: string;
  user_full_name?: string;
  district: string;
  constituency: string;
  wards: string[];
  wards_display: string;
  area?: string;
  start_date?: string;
  end_date?: string;
  status: 'ACTIVE' | 'INACTIVE';
  assigned_by?: number;
  assigner_username?: string;
  created_at: string;
  updated_at: string;
}

export interface VoterAmountAllocation {
  id: number;
  allocation_reference: string;
  voter_id: number;
  voter_name: string;
  voter_epic: string;
  house_no: string;
  district?: string;
  constituency?: string;
  ward_number?: string;
  area?: string;
  user_id: number;
  user_name: string;
  user_username: string;
  amount: number;
  allocation_date: string;
  status: 'ACTIVE' | 'REVERSED';
  remarks?: string;
  reversal_reason?: string;
  reversed_at?: string;
  created_at: string;
}
