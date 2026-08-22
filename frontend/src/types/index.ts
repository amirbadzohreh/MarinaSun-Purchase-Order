export interface Employee {
  id: number;
  personnel_number: string;
  full_name: string;
  position: string;
  department?: string;
  email?: string;
  is_active: boolean;
  signature_image?: string;
  created_at: string;
}

export interface PurchaseRequestItem {
  id: number;
  purchase_request_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ApprovalStep {
  id: number;
  purchase_request_id: number;
  step_order: number;
  approver_id: number;
  status: 'pending' | 'approved' | 'rejected';
  approver_name?: string;
  approver_personnel_number?: string;
  approver_position?: string;
}

export interface ApprovalSignature {
  id: number;
  purchase_request_id: number;
  approval_step_id: number;
  step_order: number;
  employee_id: number;
  personnel_number: string;
  full_name: string;
  position: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  signature_type: string;
  signature_hash?: string;
  signature_image?: string;
  signed_at: string;
  ip_address?: string;
  device_info?: string;
}

export interface PurchaseRequest {
  id: number;
  request_number: string;
  requester_id: number;
  title: string;
  description?: string;
  total_amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'returned_for_documents';
  current_step_order: number;
  attachment_url?: string;
  documents?: string;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_personnel_number?: string;
  items?: PurchaseRequestItem[];
  approval_steps?: ApprovalStep[];
  signatures?: ApprovalSignature[];
}

export interface LoginRequest {
  personnel_number: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  employee: {
    id: number;
    personnel_number: string;
    full_name: string;
    position: string;
  };
}

export interface CreatePurchaseRequestRequest {
  title: string;
  description?: string;
  items: {
    item_name: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface CreatePurchaseRequestResponse {
  id: number;
  request_number: string;
  total_amount: number;
  status: string;
}

export interface DecisionRequest {
  decision: 'approved' | 'rejected' | 'returned_for_documents';
  comment?: string;
  signature_image?: string;
}

export interface DecisionResponse {
  purchase_request_status: string;
  step_order: number;
  next_step_order?: number;
}

export interface PendingForMeResponse {
  id: number;
  request_number: string;
  title: string;
  total_amount: number;
  current_step_order: number;
  requester_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type PurchaseRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'returned_for_documents';

export const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  pending: 'در انتظار تایید',
  approved: 'تایید شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
  returned_for_documents: 'نیاز به تکمیل مدارک',
};

export const STATUS_COLORS: Record<PurchaseRequestStatus, string> = {
  pending: 'bg-warning-100 text-warning-600',
  approved: 'bg-success-100 text-success-600',
  rejected: 'bg-danger-100 text-danger-600',
  cancelled: 'bg-secondary-100 text-secondary-600',
  returned_for_documents: 'bg-info-100 text-info-600',
};