'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, initAuth } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/utils/helpers';
import logo from '@/logo.png';

const loginSchema = z.object({
  personnel_number: z.string().min(1, 'شماره پرسنلی الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      personnel_number: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsLoading(true);

    try {
      const response = await authApi.login(data);
      const { token, employee } = response.data;
      // The API returns a subset of Employee, we need to add missing fields
      const fullEmployee = {
        ...employee,
        is_active: true,
        created_at: new Date().toISOString(),
        department: '',
        email: '',
      };
      login(token, fullEmployee);
      initAuth();
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'خطا در ورود به سیستم');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-50 mb-4">
            <img src={logo} alt="ماریناسان" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900">ماریناسان</h1>
          <p className="text-secondary-500 mt-1">سیستم درخواست خرید</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-secondary-900">ورود به سیستم</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2" role="alert">
                <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="relative">
                <Input
                  label="شماره پرسنلی"
                  type="text"
                  placeholder="مثال: 1204"
                  autoComplete="username"
                  error={errors.personnel_number?.message}
                  {...register('personnel_number')}
                  leftIcon={<FiUser className="w-5 h-5 text-secondary-400" />}
                />
              </div>

              <div className="relative">
                <Input
                  label="رمز عبور"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  {...register('password')}
                  leftIcon={<FiLock className="w-5 h-5 text-secondary-400" />}
                  rightElement={
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                    >
                      {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                  }
                />
              </div>

              <Button
                type="submit"
                fullWidth
                loading={isLoading}
                className="mt-2"
              >
                ورود به سیستم
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-secondary-200">
              <p className="text-sm text-secondary-500 text-center mb-4">کاربران نمونه برای تست:</p>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="font-medium text-secondary-900">رضا احمدی - کارشناس IT</p>
                  <p className="text-secondary-600">شماره پرسنلی: 1204 | رمز: pass1204</p>
                </div>
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="font-medium text-secondary-900">سارا کریمی - مدیر IT</p>
                  <p className="text-secondary-600">شماره پرسنلی: 0817 | رمز: pass0817</p>
                </div>
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="font-medium text-secondary-900">محسن حسینی - مدیر مالی</p>
                  <p className="text-secondary-600">شماره پرسنلی: 0345 | رمز: pass0345</p>
                </div>
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="font-medium text-secondary-900">علیرضا رستمی - مدیرعامل</p>
                  <p className="text-secondary-600">شماره پرسنلی: 0129 | رمز: pass0129</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}