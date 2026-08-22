import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { purchaseRequestApi } from '@/services/api';
import { formatCurrency, formatPersianDate, getStatusBadgeClass, getStatusLabel } from '@/utils/helpers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FiSearch, FiFilter, FiFileText, FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/helpers';

export function PurchaseRequestsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: requestsResponse, isLoading, error } = useQuery({
    queryKey: ['purchaseRequests'],
    queryFn: () => purchaseRequestApi.list(),
  });

  const requests = requestsResponse?.data || [];

  const filteredRequests = requests.filter((request: any) => {
    const matchesSearch = request.request_number.includes(search) ||
      request.title.toLowerCase().includes(search.toLowerCase()) ||
      request.requester_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const statusOptions = [
    { value: '', label: 'همه وضعیت‌ها' },
    { value: 'pending', label: 'در انتظار تایید' },
    { value: 'approved', label: 'تایید شده' },
    { value: 'rejected', label: 'رد شده' },
    { value: 'cancelled', label: 'لغو شده' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">درخواست‌های خرید</h1>
            <p className="page-subtitle">لیست تمام درخواست‌های ثبت شده</p>
          </div>
          <Link to="/purchase-requests/create">
            <Button>
              <FiPlus className="w-4 h-4" />
              درخواست جدید
            </Button>
          </Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>شماره درخواست</th>
                <th>عنوان</th>
                <th>مبلغ کل</th>
                <th>وضعیت</th>
                <th>تاریخ ثبت</th>
                <th className="text-left">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="h-12"><div className="h-4 bg-secondary-200 rounded w-24"></div></td>
                  <td><div className="h-4 bg-secondary-200 rounded w-32"></div></td>
                  <td><div className="h-4 bg-secondary-200 rounded w-20"></div></td>
                  <td><div className="h-6 bg-secondary-200 rounded-full w-24"></div></td>
                  <td><div className="h-4 bg-secondary-200 rounded w-28"></div></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <FiFileText className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondary-900 mb-2">خطا در بارگذاری داده‌ها</h3>
        <Button onClick={() => window.location.reload()}>تلاش مجدد</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">درخواست‌های خرید</h1>
          <p className="page-subtitle">لیست تمام درخواست‌های ثبت شده</p>
        </div>
        <Link to="/purchase-requests/create">
          <Button>
            <FiPlus className="w-4 h-4" />
            درخواست جدید
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <Input
              placeholder="جستجو در شماره، عنوان، درخواست‌دهنده..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="فیلتر وضعیت"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          {filteredRequests.length === 0 ? (
            <div className="empty-state">
              <FiFileText className="empty-state-icon w-12 h-12" />
              <h3 className="empty-state-title">هیچ درخواستی یافت نشد</h3>
              <p className="empty-state-description">
                {search || statusFilter ? 'جستجوی شما نتیجه‌ای نداشت.' : 'هنوز درخواست خریدی ثبت نشده است.'}
              </p>
              {!search && !statusFilter && (
                <Link to="/purchase-requests/create">
                  <Button className="mt-4">
                    <FiPlus className="w-4 h-4" />
                    ثبت اولین درخواست
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>شماره درخواست</th>
                    <th>عنوان</th>
                    <th>مبلغ کل</th>
                    <th>وضعیت</th>
                    <th>تاریخ ثبت</th>
                    <th className="text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="font-medium text-secondary-900">{request.request_number}</td>
                      <td className="max-w-xs truncate">{request.title}</td>
                      <td className="font-medium">{formatCurrency(request.total_amount)}</td>
                      <td>
                        <span className={cn('badge', getStatusBadgeClass(request.status))}>
                          {getStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="text-secondary-500">{formatPersianDate(request.created_at)}</td>
                      <td className="text-left">
                        <Link to={`/purchase-requests/${request.id}`}>
                          <Button variant="ghost" size="sm">
                            مشاهده
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}