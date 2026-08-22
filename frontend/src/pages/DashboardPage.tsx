'use client';

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { purchaseRequestApi } from '@/services/api';
import { formatCurrency, formatPersianDate, getStatusBadgeClass, getStatusLabel } from '@/utils/helpers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FiPlus, FiFileText, FiClock, FiCheckCircle, FiXCircle, FiArrowRight, FiTrendingUp, FiTrendingDown, FiMinus, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: requestsResponse, isLoading, error } = useQuery({
    queryKey: ['purchaseRequests'],
    queryFn: () => purchaseRequestApi.list(),
    staleTime: 1000 * 60 * 2,
  });

  const { data: pendingForMeResponse } = useQuery({
    queryKey: ['pendingForMe'],
    queryFn: () => purchaseRequestApi.pendingForMe(),
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
  });

  const requests = requestsResponse?.data || [];
  const pendingForMe = pendingForMeResponse?.data || [];
  
  const pendingCount = pendingForMe.length || 0;
  const approvedCount = requests.filter((r: any) => r.status === 'approved').length || 0;
  const rejectedCount = requests.filter((r: any) => r.status === 'rejected').length || 0;
  const approvedAmount = requests
    .filter((r: any) => r.status === 'approved')
    .reduce((sum: number, r: any) => sum + Number(r.total_amount), 0) || 0;

  const recentRequests = requests.slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">داشبورد</h1>
            <p className="page-subtitle">خوش آمدید، {user?.full_name}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-secondary-200 rounded w-1/4 mb-2"></div>
              <div className="h-10 bg-secondary-200 rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondary-900 mb-2">خطا در بارگذاری داده‌ها</h3>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
          تلاش مجدد
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">داشبورد</h1>
          <p className="page-subtitle">خوش آمدید، {user?.full_name} - {user?.position}</p>
        </div>
        <Link to="/purchase-requests/create">
          <Button>
            <FiPlus className="w-4 h-4" />
            درخواست جدید
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-500 text-sm">مجموع درخواست‌ها</p>
              <p className="text-3xl font-bold text-secondary-900 mt-1">{requests?.length || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center">
              <FiFileText className="w-6 h-6 text-secondary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-500 text-sm">در انتظار تایید</p>
              <p className="text-3xl font-bold text-secondary-900 mt-1">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-warning-100 flex items-center justify-center">
              <FiClock className="w-6 h-6 text-warning-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-500 text-sm">تایید شده</p>
              <p className="text-3xl font-bold text-secondary-900 mt-1">{approvedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
              <FiCheckCircle className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-500 text-sm">رد شده</p>
              <p className="text-3xl font-bold text-secondary-900 mt-1">{rejectedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center">
              <FiXCircle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>عملیات سریع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/purchase-requests/create">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FiPlus className="w-4 h-4" />
                  <span>ثبت درخواست خرید جدید</span>
                </Button>
              </Link>
              <Link to="/purchase-requests">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FiFileText className="w-4 h-4" />
                  <span>مشاهده همه درخواست‌ها</span>
                </Button>
              </Link>
              <Link to="/pending-approvals">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FiClock className="w-4 h-4" />
                  <span>در انتظار تایید من ({pendingCount})</span>
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>مبلغ کل درخواست‌های تایید شده</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-primary-600">{formatCurrency(approvedAmount)}</p>
                <p className="text-sm text-secondary-500 mt-1">مجموع درخواست‌های تایید شده</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>آخرین درخواست‌ها</CardTitle>
              <Link to="/purchase-requests">
                <Button variant="ghost" size="sm">
                  مشاهده همه
                  <FiArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentRequests.length === 0 ? (
                <div className="empty-state p-12">
                  <FiFileText className="empty-state-icon w-12 h-12" />
                  <h3 className="empty-state-title">هیچ درخواستی یافت نشد</h3>
                  <p className="empty-state-description">هنوز درخواست خریدی ثبت نشده است.</p>
                  <Link to="/purchase-requests/create">
                    <Button className="mt-4">
                      <FiPlus className="w-4 h-4" />
                      ثبت اولین درخواست
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>شماره درخواست</th>
                        <th>عنوان</th>
                        <th className="hidden sm:table-cell">مبلغ کل</th>
                        <th>وضعیت</th>
                        <th className="hidden md:table-cell">تاریخ ثبت</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="font-medium text-secondary-900">{request.request_number}</td>
                          <td className="max-w-xs truncate">{request.title}</td>
                          <td className="hidden sm:table-cell font-medium">{formatCurrency(request.total_amount)}</td>
                          <td>
                            <Badge variant={request.status as any}>{getStatusLabel(request.status)}</Badge>
                          </td>
                          <td className="hidden md:table-cell text-secondary-500">{formatPersianDate(request.created_at)}</td>
                          <td className="text-left">
                            <Link to={`/purchase-requests/${request.id}`}>
                              <Button variant="ghost" size="sm">مشاهده</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}