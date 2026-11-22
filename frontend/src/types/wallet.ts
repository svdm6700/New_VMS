export interface Wallet {
  id: number;
  owner_type: 'ADMIN' | 'USER';
  owner_id: number;
  owner_username?: string;
  owner_full_name?: string;
  available_balance: number;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at?: string;
  updated_at?: string;
}

export interface WalletTransaction {
  id: number;
  transaction_id: string;
  wallet_id: number;
  transaction_type:
    | 'ADMIN_WALLET_CREDIT'
    | 'ADMIN_TO_USER_ALLOCATION'
    | 'USER_WALLET_CREDIT'
    | 'VOTER_AMOUNT_DEBIT'
    | 'TRANSACTION_REVERSAL'
    | 'REFUND';
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  idempotency_key?: string;
  payment_method?: string;
  remarks?: string;
  created_by?: number;
  creator_username?: string;
  created_at: string;
}

export interface UserWalletSummary {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  assigned_constituency: string;
  assigned_wards: string;
  has_geographic_assignment: boolean;
  available_balance: number;
  total_allocated: number;
  total_spent: number;
  status: 'Active' | 'Inactive';
}

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
  wallet_transaction_id?: number;
  transaction_id?: string;
  amount: number;
  allocation_date: string;
  status: 'ACTIVE' | 'REVERSED';
  remarks?: string;
  reversal_reason?: string;
  reversed_at?: string;
  created_at: string;
}

export interface WalletGlobalSummary {
  admin_available_balance: number;
  total_amount_funded: number;
  total_allocated_to_users: number;
  total_user_wallets_balance: number;
  total_spent_on_voters: number;
  total_refunds: number;
  active_user_wallets_count: number;
  total_allocations_count: number;
}
