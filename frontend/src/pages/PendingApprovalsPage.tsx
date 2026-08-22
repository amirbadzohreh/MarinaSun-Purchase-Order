import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { purchaseRequestApi } from '@/services/api';
import { formatCurrency, formatPersianDate, getStatusBadgeClass, getStatusLabel } from '@/utils/helpers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FiInbox, FiArrowRight, FiUser, FiDollarSign, FiClock, FiAlertCircle, FiCheckCircle, FiXCircle, FiFileText } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

export function PendingApprovalsPage() {
  const { data: requestsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: () => purchaseRequestApi.pendingForMe(),
  });

  const requests = requestsResponse?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">در انتظار تایید من</h1>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondary-900 mb-2">خطا در بارگذاری</h3>
        <p className="text-secondary-500 mb-4">نمی‌توان درخواست‌های در انتظار را دریافت کرد</p>
        <Button variant="outline" onClick={() => refetch()}>
          تلاش مجدد
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">در انتظار تایید من</h1>
          <p className="page-subtitle">
            {requests?.length || 0} درخواست در نوبت تایید شما قرار دارد
          </p>
        </div>
      </div>

      {requests && requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <Link
              key={request.id}
              to={`/purchase-requests/${request.id}`}
              className="card hover:shadow-md transition-shadow duration-200 block"
            >
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={cn('badge px-3 py-1', getStatusBadgeClass(request.status))}>
                        {getStatusLabel(request.status)}
                      </span>
                      <span className="text-sm text-secondary-500">مرحله {request.current_step_order}</span>
                    </div>
                    <h3 className="font-semibold text-lg text-secondary-900 truncate mb-1">
                      {request.request_number} - {request.title}
                    </h3>
                    <p className="text-sm text-secondary-600">درخواست‌دهنده: {request.requester_name}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-left sm:text-right">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">{formatCurrency(request.total_amount)}</p>
                      <p className="text-xs text-secondary-400">مبلغ کل</p>
                    </div>
                    <Button variant="primary" size="sm" className="w-full sm:w-auto">
                      <FiArrowRight className="w-4 h-4" />
                      بررسی و اقدام
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <FiInbox className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-secondary-900 mb-2">درخواست در انتظار تایید شما وجود ندارد</h3>
            <p className="text-secondary-500">زمانی که درخواستی به شما ارجاع داده شود، در اینجا نمایش داده می‌شود.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}