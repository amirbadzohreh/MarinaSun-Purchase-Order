import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { purchaseRequestApi } from '@/services/api';
import { formatCurrency, formatPersianDate, getStatusBadgeClass, getStatusLabel, getDecisionLabel } from '@/utils/helpers';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FiArrowLeft, FiFileText, FiUser, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiMessageSquare, FiPrinter, FiPenTool } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

export function ApprovedRequestPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const requestId = parseInt(id || '0', 10);
  const [printReady, setPrintReady] = useState(false);

  const { data: requestResponse, isLoading, error } = useQuery({
    queryKey: ['purchaseRequest', requestId],
    queryFn: () => purchaseRequestApi.get(requestId),
    enabled: !!requestId,
  });

  const request = requestResponse?.data;

  useEffect(() => {
    if (!isLoading && request && !printReady) {
      const timer = setTimeout(() => setPrintReady(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, request, printReady]);

  const stepLabels: Record<number, string> = {
    1: 'مدیر IT',
    2: 'مدیر مالی',
    3: 'مدیرعامل',
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="card p-8 text-center">
          <FiAlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">درخواست یافت نشد</h3>
          <Button variant="secondary" onClick={() => navigate('/purchase-requests')}>
            بازگشت به لیست
          </Button>
        </div>
      </div>
    );
  }

  if (request.status !== 'approved') {
    const message = request.status === 'rejected'
      ? 'درخواست‌های رد شده قابل چاپ نیستند'
      : 'تنها درخواست‌های تایید شده قابل چاپ هستند';
    const detail = request.status === 'rejected'
      ? 'این درخواست رد شده و قابل چاپ نیست'
      : 'این درخواست هنوز تایید نهایی نشده است';
    
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-8">
        <div className="card p-8 text-center max-w-md">
          <FiAlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">{message}</h3>
          <p className="text-secondary-500 mb-4">{detail}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            بازگشت
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-2 md:p-4 print:p-1">
      {/* Print Header - Hidden on screen, visible on print */}
      <div className="print-only mb-2 md:mb-3 print:mb-2">
        <div className="flex items-center justify-between border-b border-secondary-300 pb-2 md:pb-3 print:pb-2 print:mb-2">
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo.png" alt="ماریناسان" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-secondary-900">ماریناسان</h1>
              <p className="text-secondary-600 text-xs md:text-sm">سیستم درخواست خرید</p>
            </div>
          </div>
          <div className="text-left text-[10px] md:text-xs">
            <p>شماره: {request.request_number}</p>
            <p>چاپ: {new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</p>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="screen-only mb-2 md:mb-3 print:mb-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base md:text-lg font-bold text-secondary-900">برگه چاپ درخواست تایید شده</h1>
            <p className="text-secondary-600 text-xs md:text-sm">{request.request_number} - {request.title}</p>
          </div>
          <div className="flex gap-1 md:gap-2 mt-2 md:mt-0">
            <Button variant="secondary" onClick={() => navigate(-1)} className="text-xs py-1 px-2">
              <FiArrowLeft className="w-3 h-3" />
              بازگشت
            </Button>
            <Button variant="primary" onClick={() => window.print()} className="flex-1 sm:flex-none text-xs py-1 px-2">
              <FiPrinter className="w-3 h-3" />
              چاپ / PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1 md:space-y-2 print:space-y-1">
        {/* Request Info */}
        <Card className="p-2 md:p-3 print:p-2 border border-secondary-200">
          <div className="flex items-center gap-1 mb-2 md:mb-2 print:mb-1 border-b border-secondary-200 pb-1 md:pb-2 print:pb-1">
            <FiFileText className="w-3 h-3 md:w-4 md:h-4 text-primary-600" />
            <h3 className="text-sm md:text-lg font-bold text-secondary-900">اطلاعات درخواست</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 print:gap-2">
            <div>
              <p className="text-[10px] md:text-xs text-secondary-500">شماره درخواست</p>
              <p className="font-medium text-secondary-900 text-xs md:text-sm">{request.request_number}</p>
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-secondary-500">تاریخ ثبت</p>
              <p className="font-medium text-secondary-900 text-xs md:text-sm">{formatPersianDate(request.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-secondary-500">درخواست‌دهنده</p>
              <p className="font-medium text-secondary-900 text-xs md:text-sm">{request.requester_name}</p>
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-secondary-500">مبلغ کل</p>
              <p className="text-sm md:text-lg font-bold text-primary-600">{formatCurrency(request.total_amount)}</p>
            </div>
          </div>

          {request.description && (
            <div className="pt-2 md:pt-2 print:pt-2 border-t border-secondary-200 mt-2 md:mt-2 print:mt-2">
              <p className="text-[10px] md:text-xs text-secondary-500 mb-1">توضیحات</p>
              <p className="text-secondary-900 whitespace-pre-wrap text-xs md:text-sm">{request.description}</p>
            </div>
          )}
        </Card>

        {/* Items */}
        <Card className="p-2 md:p-3 print:p-2 border border-secondary-200">
          <div className="flex items-center gap-1 mb-2 md:mb-2 print:mb-1 border-b border-secondary-200 pb-1 md:pb-2 print:pb-1">
            <FiDollarSign className="w-3 h-3 md:w-4 md:h-4 text-primary-600" />
            <h3 className="text-sm md:text-lg font-bold text-secondary-900">اقلام درخواست</h3>
          </div>
          <div className="table-container overflow-x-auto">
            <table className="table w-full text-[10px] md:text-xs print:text-[9px] md:print:text-xs">
              <thead>
                <tr className="border-b border-secondary-300">
                  <th className="text-right p-1 md:p-2 print:p-1 font-semibold text-secondary-900">نام کالا/خدمت</th>
                  <th className="text-center p-1 md:p-2 print:p-1 font-semibold text-secondary-900">تعداد</th>
                  <th className="text-center p-1 md:p-2 print:p-1 font-semibold text-secondary-900">قیمت واحد</th>
                  <th className="text-center p-1 md:p-2 print:p-1 font-semibold text-secondary-900">مبلغ کل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {request.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary-50 print:hover:bg-transparent">
                    <td className="p-1 md:p-2 print:p-1 font-medium text-secondary-900 text-xs md:text-sm">{item.item_name}</td>
                    <td className="text-center p-1 md:p-2 print:p-1 text-secondary-900 text-[10px]">{item.quantity}</td>
                    <td className="text-center p-1 md:p-2 print:p-1 text-secondary-900 text-[10px]">{formatCurrency(item.unit_price)}</td>
                    <td className="text-center p-1 md:p-2 font-bold text-primary-600 text-[10px]">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary-50 border-t border-secondary-300">
                  <td className="p-1 md:p-2 font-semibold text-secondary-900 text-right text-xs" colSpan={3}>مبلغ کل</td>
                  <td className="text-center p-1 md:p-2 font-bold text-base text-primary-600">{formatCurrency(request.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Approval Workflow with Signatures */}
        <Card className="p-2 md:p-3 print:p-2 border border-secondary-200">
          <div className="flex items-center gap-1 mb-2 md:mb-3 print:mb-2 border-b border-secondary-200 pb-1 md:pb-2">
            <FiPenTool className="w-3 h-3 md:w-4 md:h-4 text-primary-600" />
            <h3 className="text-sm md:text-lg font-bold text-secondary-900">گردش تایید و امضاهای دیجیتال</h3>
          </div>
          <div className="space-y-1 md:space-y-2 print:space-y-1">
            {request.approval_steps?.map((step) => {
              const signature = request.signatures?.find(s => s.step_order === step.step_order);
              const isApproved = step.status === 'approved';
              const isRejected = step.status === 'rejected';

              return (
                <div
                  key={step.id}
                  className={`relative p-2 md:p-3 print:p-2 rounded border transition-colors ${
                    isApproved ? 'border-success-300 bg-success-50' :
                    isRejected ? 'border-danger-300 bg-danger-50' :
                    'border-warning-300 bg-warning-50'
                  }`}
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 print:mb-1">
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
                        isApproved ? 'bg-success-100 text-success-600' :
                        isRejected ? 'bg-danger-100 text-danger-600' :
                        'bg-warning-100 text-warning-600'
                      }`}>
                        <span className="text-sm md:text-lg font-bold">{step.step_order}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-secondary-900">{stepLabels[step.step_order] || `مرحله ${step.step_order}`}</h4>
                        <p className="text-[10px] text-secondary-500">{step.approver_name} - {step.approver_position}</p>
                      </div>
                    </div>
                    <Badge className={cn(
                      'text-[10px] px-1.5 py-0.5',
                      isApproved ? 'bg-success-100 text-success-600' :
                      isRejected ? 'bg-danger-100 text-danger-600' :
                      'bg-warning-100 text-warning-600'
                    )}>
                      {getStatusLabel(step.status)}
                    </Badge>
                  </div>

                  {/* Signature */}
                  {signature && (
                    <div className="bg-white rounded border border-secondary-200 p-2 print:p-2">
                      <div className="flex flex-col sm:flex-row gap-2 md:gap-3 print:gap-2">
                        {/* Signature Image */}
                        <div className="flex-shrink-0 w-24 md:w-32 h-12 md:h-16 flex items-center justify-center bg-secondary-50 rounded border border-secondary-200">
                          {signature.signature_image && (
                            <img
                              src={signature.signature_image}
                              alt={`امضای ${signature.full_name}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          )}
                          {!signature.signature_image && (
                            <span className="text-secondary-400 text-[10px] md:text-xs">امضاء موجود نیست</span>
                          )}
                        </div>

                        {/* Signature Details */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
                            <span className="font-medium text-secondary-900 flex items-center gap-0.5">
                              <FiUser className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {signature.full_name}
                            </span>
                            <span className="text-secondary-500 flex items-center gap-1">
                              <FiUser className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {signature.position}
                            </span>
                            <span className="text-secondary-500 flex items-center gap-1">
                              <FiClock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {formatPersianDate(signature.signed_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className={cn(
                              isApproved ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600',
                              'text-[10px]'
                            )}>
                              {getDecisionLabel(signature.decision)}
                            </Badge>
                          </div>
                          {signature.comment && (
                            <div className="pt-1 border-t border-secondary-200">
                              <p className="text-[10px] text-secondary-700 italic flex items-center gap-0.5">
                                <FiMessageSquare className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                {signature.comment}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Footer */}
        <div className="print-only mt-2 md:mt-3 pt-1 md:pt-2 border-t border-secondary-300 text-center text-[10px] md:text-xs text-secondary-500">
          <p>این سند به صورت دیجیتال امضا شده و معتبر می‌باشد</p>
          <p className="mt-0.5">ماریناسان - سیستم درخواست خرید</p>
        </div>
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            .screen-only { display: none !important; }
            .print-only { display: block !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { margin: 0.5cm; size: A4; }
            body { font-size: 9pt; line-height: 1.3; }
            .card { box-shadow: none !important; border: 0.5px solid #e2e8f0 !important; page-break-inside: avoid; }
            .badge { font-size: 0.6rem !important; }
            table { font-size: 9pt !important; }
          }
          @media screen {
            .print-only { display: none !important; }
          }
        `
        }}
      />
    </div>
  );
}
