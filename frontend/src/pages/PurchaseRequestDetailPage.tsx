'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { purchaseRequestApi, employeeApi, getAuthToken } from '@/services/api';
import { formatCurrency, formatPersianDate, getStatusBadgeClass, getStatusLabel, getDecisionLabel, getDecisionBadgeClass, getCurrentUserId } from '@/utils/helpers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { FiArrowLeft, FiFileText, FiUser, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiMessageSquare, FiEye, FiLoader, FiCheck, FiX, FiPrinter, FiRotateCcw, FiUpload, FiFile, FiEdit } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

export function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestId = parseInt(id || '0', 10);

  const [decision, setDecision] = useState<'approved' | 'rejected' | 'returned_for_documents' | null>(null);
  const [comment, setComment] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [documents, setDocuments] = useState<string | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  const { data: requestResponse, isLoading, error } = useQuery({
    queryKey: ['purchaseRequest', requestId],
    queryFn: () => purchaseRequestApi.get(requestId),
    enabled: !!requestId,
  });

  // Load saved signature when decision modal opens
  useEffect(() => {
    if (showDecisionModal && !savedSignature) {
      employeeApi.getMySignature()
        .then((res: { data: { signature_image: string | null } }) => setSavedSignature(res.data.signature_image))
        .catch(() => setSavedSignature(null));
    }
  }, [showDecisionModal, savedSignature]);

  // Use saved signature when modal opens
  useEffect(() => {
    if (showDecisionModal && savedSignature && !signatureImage) {
      setSignatureImage(savedSignature);
    }
  }, [showDecisionModal, savedSignature, signatureImage]);

  const request = requestResponse?.data;

  const { mutate: submitDecision, isPending: isDeciding } = useMutation({
    mutationFn: ({ decision, comment, signatureImage }: { decision: 'approved' | 'rejected' | 'returned_for_documents'; comment: string; signatureImage?: string }) =>
      purchaseRequestApi.decide(requestId, { decision, comment, signature_image: signatureImage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequest', requestId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      setShowDecisionModal(false);
      setDecision(null);
      setComment('');
      setSignatureImage(null);
      setSavedSignature(null);
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در ثبت تصمیم: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
    },
  });

  const { mutate: uploadDocuments, isPending: isUploadingDocsMutate } = useMutation({
    mutationFn: (docs: string) => purchaseRequestApi.updateDocuments(requestId, docs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequest', requestId] });
      setIsUploadingDocs(false);
      alert('مدارک با موفقیت آپلود شد');
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در آپلود مدارک: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
      setIsUploadingDocs(false);
    },
  });

  const { mutate: resubmitRequest, isPending: isResubmittingMutate } = useMutation({
    mutationFn: () => purchaseRequestApi.resubmit(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequest', requestId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      setIsResubmitting(false);
      alert('درخواست با موفقیت مجدداً ارسال شد');
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در ارسال مجدد: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
      setIsResubmitting(false);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <FiArrowLeft className="w-4 h-4" />
            بازگشت
          </Button>
          <div className="flex-1"></div>
        </div>
        <div className="flex justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="card p-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondary-900 mb-2">درخواست یافت نشد</h3>
        <Button variant="secondary" onClick={() => navigate('/purchase-requests')}>
          بازگشت به لیست
        </Button>
      </div>
    );
  }

  const canAct = request.status === 'pending' && 
    request.approval_steps?.some(step => 
      step.step_order === request.current_step_order && 
      step.status === 'pending'
    );

  const currentStep = request.approval_steps?.find(s => s.step_order === request.current_step_order);
  const isCurrentApprover = currentStep && canAct;

  const currentUserId = getCurrentUserId();
  const isRequester = request.requester_id && currentUserId && request.requester_id === currentUserId;

  const stepLabels: Record<number, string> = {
    1: 'مدیر IT',
    2: 'مدیر مالی',
    3: 'مدیرعامل',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <FiArrowLeft className="w-4 h-4" />
          بازگشت
        </Button>
        <div className="flex-1">
          <h1 className="page-title">{request.request_number}</h1>
          <p className="page-subtitle">{request.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn('text-sm', getStatusBadgeClass(request.status))}>
            {getStatusLabel(request.status)}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FiFileText className="w-5 h-5 text-primary-600" />
                جزئیات درخواست
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-secondary-500">شماره درخواست</p>
                  <p className="font-medium text-secondary-900">{request.request_number}</p>
                </div>
                <div>
                  <p className="text-sm text-secondary-500">تاریخ ثبت</p>
                  <p className="font-medium text-secondary-900">{formatPersianDate(request.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-secondary-500">درخواست‌دهنده</p>
                  <p className="font-medium text-secondary-900">{request.requester_name}</p>
                </div>
                <div>
                  <p className="text-sm text-secondary-500">مبلغ کل</p>
                  <p className="text-2xl font-bold text-primary-600">{formatCurrency(request.total_amount)}</p>
                </div>
              </div>

              {request.description && (
                <div className="pt-4 border-t border-secondary-200">
                  <p className="text-sm text-secondary-500 mb-1">توضیحات</p>
                  <p className="text-secondary-900 whitespace-pre-wrap">{request.description}</p>
                </div>
              )}

              {request.documents && (
                <div className="pt-4 border-t border-secondary-200">
                  <p className="text-sm text-secondary-500 mb-1">مدارک و پیوست‌ها</p>
                  <div className="p-3 bg-secondary-50 rounded-lg border border-secondary-200 whitespace-pre-wrap text-secondary-900">
                    {request.documents}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FiDollarSign className="w-5 h-5 text-primary-600" />
                اقلام درخواست
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>نام کالا/خدمت</th>
                      <th className="text-left">تعداد</th>
                      <th className="text-left">قیمت واحد</th>
                      <th className="text-left">مبلغ کل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-left">{item.quantity}</td>
                        <td className="text-left">{formatCurrency(item.unit_price)}</td>
                        <td className="text-left font-bold text-primary-600">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Approval Workflow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FiUser className="w-5 h-5 text-primary-600" />
                گردش تاییدیه
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {request.approval_steps?.map((step, index) => {
                  const signature = request.signatures?.find(s => s.step_order === step.step_order);
                  const isActive = step.step_order === request.current_step_order && request.status === 'pending';
                  const isCompleted = step.status === 'approved' || step.status === 'rejected';
                  const isPending = step.status === 'pending' && !isActive;

                  let stepStatus: 'completed' | 'active' | 'pending' | 'rejected' = 'pending';
                  if (step.status === 'approved') stepStatus = 'completed';
                  else if (step.status === 'rejected') stepStatus = 'rejected';
                  else if (isActive) stepStatus = 'active';

                  return (
                    <div 
                      key={step.id} 
                      className={cn('relative flex items-start gap-4 p-4 rounded-xl border transition-colors',
                        isActive ? 'bg-primary-50 border-primary-200' : 'bg-white border-secondary-200'
                      )}
                    >
                      {/* Step Indicator */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={cn('step-circle w-10 h-10', stepStatus)}>
                          {stepStatus === 'completed' && <FiCheck className="w-5 h-5" />}
                          {stepStatus === 'rejected' && <FiX className="w-5 h-5" />}
                          {(stepStatus === 'active' || stepStatus === 'pending') && <span className="font-bold">{step.step_order}</span>}
                        </div>
                        <div className="w-0.5 h-16 bg-secondary-200" />
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-secondary-900">{stepLabels[step.step_order] || `مرحله ${step.step_order}`}</h4>
                          <Badge variant={step.status === 'approved' ? 'success' : step.status === 'rejected' ? 'danger' : 'pending'}>
                            {getStatusLabel(step.status)}
                          </Badge>
                          {isActive && (
                            <Badge variant="info" className="animate-pulse">
                              در انتظار اقدام شما
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-secondary-600">
                          تاییدکننده: <span className="font-medium">{step.approver_name || 'تعیین نشده'}</span>
                          {step.approver_personnel_number && (
                            <> - <span className="text-secondary-500">{step.approver_personnel_number}</span></>
                          )}
                        </p>

                        {signature && (
                          <div className="mt-3 p-3 bg-secondary-50 rounded-lg border border-secondary-200">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={signature.decision === 'approved' ? 'success' : 'danger'}>
                                {getDecisionLabel(signature.decision)}
                              </Badge>
                              <span className="text-sm text-secondary-500">
                                در {formatPersianDate(signature.signed_at)}
                              </span>
                            </div>
                            {signature.comment && (
                              <p className="text-sm text-secondary-700 italic">
                                <FiMessageSquare className="w-3 h-3 inline mr-1" /> {signature.comment}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Signatures History */}
          {request.signatures && request.signatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FiMessageSquare className="w-5 h-5 text-primary-600" />
                  تاریخچه امضاها و نظرات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {request.signatures.map((sig) => (
                    <div key={sig.id} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={sig.decision === 'approved' ? 'success' : 'danger'}>
                          {getDecisionLabel(sig.decision)}
                        </Badge>
                        <span className="font-medium text-secondary-900">{sig.full_name}</span>
                        <span className="text-sm text-secondary-500">({sig.position})</span>
                        <span className="text-sm text-secondary-400 ml-auto">
                          {formatPersianDate(sig.signed_at)}
                        </span>
                      </div>
                      {sig.comment && (
                        <p className="text-sm text-secondary-700 italic pr-8">
                          <FiMessageSquare className="w-3 h-3 inline mr-1" /> {sig.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decision Modal Trigger */}
          {isCurrentApprover && request.status === 'pending' && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <FiAlertCircle className="w-6 h-6 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-primary-900">این درخواست در انتظار تایید شماست</p>
                  <p className="text-sm text-primary-700">شما به عنوان {stepLabels[currentStep?.step_order || 1]} می‌توانید درخواست را تایید، رد یا برای تکمیل مدارک برگردانید</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="primary" 
                  onClick={() => { setDecision('approved'); setShowDecisionModal(true); }}
                  className="flex-1"
                >
                  <FiCheck className="w-4 h-4" />
                  تایید و ارسال به مرحله بعد
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => { setDecision('returned_for_documents'); setShowDecisionModal(true); }}
                  className="flex-1"
                >
                  <FiRotateCcw className="w-4 h-4" />
                  برگشت برای مدارک
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => { setDecision('rejected'); setShowDecisionModal(true); }}
                  className="flex-1"
                >
                  <FiX className="w-4 h-4" />
                  رد درخواست
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>خلاصه وضعیت</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-500">وضعیت کلی</p>
                <Badge className={cn('text-lg px-4 py-2', getStatusBadgeClass(request.status))}>
                  {getStatusLabel(request.status)}
                </Badge>
              </div>

              <div className="border-t border-secondary-200 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-secondary-600">مبلغ کل</span>
                  <span className="font-bold text-lg text-primary-600">{formatCurrency(request.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">مرحله فعلی</span>
                  <span className="font-medium">{request.current_step_order} از {request.approval_steps?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-600">تاریخ ثبت</span>
                  <span className="font-medium text-secondary-900">{formatPersianDate(request.created_at)}</span>
                </div>
              </div>

              {request.status === 'rejected' && (
                <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="text-sm text-danger-700">
                    <FiXCircle className="w-4 h-4 inline mr-1" />
                    این درخواست رد شده است و قابل ویرایش یا تایید مجدد نیست.
                  </p>
                </div>
              )}

              {request.status === 'approved' && (
                <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                  <p className="text-sm text-success-700">
                    <FiCheckCircle className="w-4 h-4 inline mr-1" />
                    این درخواست به طور کامل تایید شده است.
                  </p>
                </div>
              )}

              {request.status === 'returned_for_documents' && isRequester && (
                <div className="space-y-4">
                  <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                    <p className="text-sm text-warning-700">
                      <FiAlertCircle className="w-4 h-4 inline mr-1" />
                      این درخواست برای تکمیل مدارک به شما برگردانده شده است. لطفاً مدارک را آپلود کرده و مجدداً ارسال کنید.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="label">مدارک و پیوست‌ها <span className="text-danger-500">*</span></label>
                    <textarea
                      value={documents || ''}
                      onChange={(e) => setDocuments(e.target.value)}
                      rows={4}
                      className="input"
                      placeholder="توضیحات و اطلاعات مدارک را اینجا وارد کنید..."
                      required
                    />
                    {documents && (
                      <p className="text-xs text-success-600">
                        <FiCheck className="w-3 h-3 inline mr-1" />
                        مدارک وارد شده است
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="secondary" 
                      className="flex-1"
                      onClick={() => uploadDocuments(documents || '')}
                      loading={isUploadingDocsMutate}
                      disabled={!documents?.trim()}
                    >
                      <FiUpload className="w-4 h-4" />
                      آپلود مدارک
                    </Button>
                    <Button 
                      variant="primary" 
                      className="flex-1"
                      onClick={() => resubmitRequest()}
                      loading={isResubmittingMutate}
                      disabled={!documents?.trim()}
                    >
                      <FiRotateCcw className="w-4 h-4" />
                      ارسال مجدد درخواست
                    </Button>
                  </div>
                </div>
              )}

              {/* Print Button for Approved Requests */}
              {request.status === 'approved' && (
                <Button 
                  variant="primary" 
                  className="w-full" 
                  onClick={() => navigate(`/purchase-requests/${request.id}/print`)}
                >
                  <FiPrinter className="w-4 h-4" />
                  چاپ سند تاییدیه
                </Button>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>عملیات سریع</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/purchase-requests')}>
                    <FiArrowLeft className="w-4 h-4" />
                    بازگشت به لیست
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>

{/* Decision Modal */}
      {showDecisionModal && decision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-slide-up">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center',
                  decision === 'approved' ? 'bg-success-100 text-success-600' :
                  decision === 'returned_for_documents' ? 'bg-warning-100 text-warning-600' :
                  'bg-danger-100 text-danger-600'
                )}>
                  {decision === 'approved' ? <FiCheck className="w-6 h-6" /> :
                   decision === 'returned_for_documents' ? <FiRotateCcw className="w-6 h-6" /> :
                   <FiX className="w-6 h-6" />}
                </div>
                <h3 className="text-lg font-semibold text-secondary-900">
                  {decision === 'approved' ? 'تایید درخواست' :
                   decision === 'returned_for_documents' ? 'نیاز به تکمیل مدارک' :
                   'رد درخواست'}
                </h3>
              </div>

              <p className="text-secondary-600 mb-6">
                {decision === 'approved'
                  ? 'آیا مطمئن هستید که می‌خواهید این درخواست را تایید و به مرحله بعد بفرستید؟'
                  : decision === 'returned_for_documents'
                  ? 'آیا مطمئن هستید که می‌خواهید این درخواست را برای تکمیل مدارک به درخواست‌دهنده برگردانید؟ درخواست در وضعیت "نیاز به تکمیل مدارک" قرار می‌گیرد.'
                  : 'آیا مطمئن هستید که می‌خواهید این درخواست را رد کنید؟ درخواست رد شده قابل بازگشت نیست.'
                }
              </p>

              <div className="mb-4">
                <label className="label">نظر/توضیح {decision !== 'approved' && <span className="text-danger-500">*</span>}</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder={decision === 'approved' ? 'نظر خود را بنویسید (اختیاری)' : 'دلیل را بنویسید...'}
                  required={decision !== 'approved'}
                />
              </div>

              <div className="mb-4">
                <label className="label">امضای دیجیتال <span className="text-danger-500">*</span></label>
                <SignaturePad
                  onSave={setSignatureImage}
                  value={signatureImage}
                  height={120}
                />
                <p className="text-xs text-secondary-500 mt-1">با ماوس یا انگشت امضا کنید</p>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setShowDecisionModal(false); setDecision(null); setComment(''); setSignatureImage(null); }} className="flex-1">
                  انصراف
                </Button>
                <Button
                  variant={(decision === 'approved' ? 'primary' : decision === 'returned_for_documents' ? 'secondary' : 'danger') as 'primary' | 'secondary' | 'danger'}
                  onClick={() => submitDecision({ decision, comment, signatureImage: signatureImage || undefined })}
                  loading={isDeciding}
                  disabled={(decision !== 'approved' && !comment.trim()) || !signatureImage}
                  className="flex-1"
                >
                  {decision === 'approved' ? 'تایید و ارسال' :
                   decision === 'returned_for_documents' ? 'نیاز به تکمیل مدارک' :
                   'رد درخواست'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}