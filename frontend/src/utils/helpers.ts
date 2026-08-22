import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '۰';
  return new Intl.NumberFormat('fa-IR').format(n);
}

export function formatCurrency(amount: number | string, currency = 'IRT'): string {
  const formatted = formatNumber(amount);
  return `${formatted} ${currency === 'IRT' ? 'تومان' : currency}`;
}

export function formatPersianDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';
  
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

export function formatPersianDateShort(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';
  
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';
  
  // Convert to Tehran timezone for comparison
  const tehranDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const now = new Date();
  const nowTehran = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  
  const diffMs = nowTehran.getTime() - tehranDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'چند لحظه پیش';
  if (diffMins < 60) return `${diffMins} دقیقه پیش`;
  if (diffHours < 24) return `${diffHours} ساعت پیش`;
  if (diffDays < 7) return `${diffDays} روز پیش`;
  
  return formatPersianDateShort(date);
}

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    cancelled: 'badge-cancelled',
    returned_for_documents: 'badge-info',
  };
  return classes[status] || 'badge';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'در انتظار تایید',
    approved: 'تایید شده',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
    returned_for_documents: 'نیاز به تکمیل مدارک',
  };
  return labels[status] || status;
}

export function getDecisionLabel(decision: string): string {
  const labels: Record<string, string> = {
    approved: 'تایید',
    rejected: 'رد',
  };
  return labels[decision] || decision;
}

export function getDecisionBadgeClass(decision: string): string {
  const classes: Record<string, string> = {
    approved: 'badge-approved',
    rejected: 'badge-rejected',
  };
  return classes[decision] || 'badge';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function generateRequestNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${timestamp}-${random}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getCurrentUserId(): number | null {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.employee_id || payload.id || null;
  } catch {
    return null;
  }
}