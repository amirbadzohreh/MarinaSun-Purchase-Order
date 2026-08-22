import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FiSave, FiTrash2, FiUser, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { cn } from '@/utils/helpers';
import { employeeApi } from '@/services/api';

export function SignatureSettingsPage() {
  const queryClient = useQueryClient();
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isNewSignature, setIsNewSignature] = useState(false);

  const { data: employeeResponse, isLoading } = useQuery({
    queryKey: ['employee', 'me'],
    queryFn: () => employeeApi.getMe(),
  });

  const employee = employeeResponse?.data?.employee;

  const { mutate: saveSignature, isPending: isSaving } = useMutation({
    mutationFn: (signatureImage: string) => employeeApi.updateSignature(signatureImage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'me'] });
      alert('امضا با موفقیت ذخیره شد');
      setIsNewSignature(false);
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در ذخیره امضا: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
    },
  });

  const { mutate: deleteSignature, isPending: isDeleting } = useMutation({
    mutationFn: () => employeeApi.deleteSignature(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'me'] });
      setSignatureImage(null);
      setIsNewSignature(false);
      alert('امضا حذف شد');
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در حذف امضا: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
    },
  });

  const handleSave = () => {
    if (!signatureImage) {
      alert('لطفاً ابتدا امضا را رسم کنید');
      return;
    }
    saveSignature(signatureImage);
  };

  const handleClear = () => {
    setSignatureImage(null);
    setIsNewSignature(false);
  };

  const handleDelete = () => {
    if (window.confirm('آیا از حذف امضای ذخیره‌شده اطمینان دارید؟')) {
      deleteSignature();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">تنظیمات امضای دیجیتال</h1>
        <div className="flex justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="page-title">تنظیمات امضای دیجیتال</h1>
        <p className="page-subtitle">امضای خود را برای تایید درخواست‌ها رسم و ذخیره کنید</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiUser className="w-5 h-5 text-primary-600" />
            امضای فعلی
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee?.signature_image ? (
            <div className="space-y-4">
              <div className="relative aspect-[3/1] max-w-md rounded-lg border border-secondary-200 overflow-hidden bg-white">
                <img 
                  src={employee.signature_image} 
                  alt="امضای ذخیره‌شده" 
                  className="w-full h-full object-contain p-2"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="danger" onClick={handleDelete} disabled={isDeleting} className="flex-1">
                  <FiTrash2 className="w-4 h-4" />
                  {isDeleting ? 'در حال حذف...' : 'حذف امضا'}
                </Button>
                <Button variant="outline" onClick={() => setIsNewSignature(true)} className="flex-1">
                  تغییر امضا
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FiAlertCircle className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
              <p className="text-secondary-600 mb-4">هیچ امضایی ذخیره نشده است</p>
              <Button variant="primary" onClick={() => setIsNewSignature(true)}>
                <FiSave className="w-4 h-4" />
                رسم و ذخیره امضا
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isNewSignature && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiUser className="w-5 h-5 text-primary-600" />
              رسم امضای جدید
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm text-primary-800">
                <FiCheckCircle className="w-4 h-4 inline mr-1" />
                با موس یا انگشت امضای خود را در کادر زیر رسم کنید
              </p>
            </div>

            <SignaturePad
              value={signatureImage}
              onSave={setSignatureImage}
              height={200}
              disabled={isSaving}
            />

            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={handleSave} disabled={isSaving || !signatureImage} className="flex-1">
                <FiSave className="w-4 h-4" />
                {isSaving ? 'در حال ذخیره...' : 'ذخیره امضا'}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isSaving} className="flex-1">
                <FiTrash2 className="w-4 h-4" />
                پاک کردن
              </Button>
              <Button variant="ghost" onClick={() => setIsNewSignature(false)} disabled={isSaving} className="flex-1">
                انصراف
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}