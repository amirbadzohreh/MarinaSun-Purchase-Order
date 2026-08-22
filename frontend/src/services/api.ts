import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  LoginRequest, 
  LoginResponse, 
  PurchaseRequest, 
  CreatePurchaseRequestRequest, 
  CreatePurchaseRequestResponse,
  DecisionRequest,
  DecisionResponse,
  PendingForMeResponse,
  PurchaseRequestItem
} from '@/types';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('auth_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = (): string | null => {
  return authToken || localStorage.getItem('auth_token');
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: LoginRequest) => 
    api.post<LoginResponse>('/auth/login', data),
  
  getMe: () => 
    api.get<{ employee: LoginResponse['employee'] }>('/auth/me'),
};

export const purchaseRequestApi = {
  list: () => 
    api.get<PurchaseRequest[]>('/purchase-requests'),
  
  get: (id: number) => 
    api.get<PurchaseRequest>(`/purchase-requests/${id}`),
  
  create: (data: CreatePurchaseRequestRequest) => 
    api.post<CreatePurchaseRequestResponse>('/purchase-requests', data),
  
  decide: (id: number, data: DecisionRequest) => 
    api.post<DecisionResponse>(`/purchase-requests/${id}/decision`, data),
  
  updateDocuments: (id: number, documents: string) =>
    api.post<{ success: boolean; message: string }>(`/purchase-requests/${id}/documents`, { documents }),
  
  resubmit: (id: number) =>
    api.post<{ success: boolean; message: string; status: string }>(`/purchase-requests/${id}/resubmit`),
  
  pendingForMe: () => 
    api.get<PendingForMeResponse[]>('/purchase-requests/pending-for-me'),
};

export const healthApi = {
  check: () => 
    api.get<{ status: string }>('/health'),
};

export const employeeApi = {
  getMe: () =>
    api.get<{ employee: { id: number; personnel_number: string; full_name: string; position: string; signature_image: string | null } }>('/employees/me'),
  
  getMySignature: () =>
    api.get<{ signature_image: string | null }>('/employees/me/signature'),
  
  updateSignature: (signatureImage: string) =>
    api.post<{ success: boolean; message: string }>('/employees/me/signature', { signature_image: signatureImage }),
  
  deleteSignature: () =>
    api.delete<{ success: boolean; message: string }>('/employees/me/signature'),
};

export const initAuth = () => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    setAuthToken(token);
  }
};

export default api;