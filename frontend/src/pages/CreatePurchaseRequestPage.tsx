'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiMinus, FiX, FiLoader, FiCheck, FiArrowLeft, FiDollarSign, FiFileText } from 'react-icons/fi';
import { purchaseRequestApi } from '@/services/api';
import { formatCurrency } from '@/utils/helpers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { cn } from '@/utils/helpers';

const itemSchema = z.object({
  item_name: z.string().min(1, 'نام کالا/خدمت الزامی است').max(200),
  quantity: z.number().min(1, 'تعداد باید حداقل ۱ باشد').max(1000000),
  unit_price: z.number().min(1, 'قیمت واحد باید حداقل ۱ تومان باشد'),
});

const createRequestSchema = z.object({
  title: z.string().min(3, 'عنوان باید حداقل ۳ کاراکتر باشد').max(200),
  description: z.string().max(1000, 'توضیحات حداکثر ۱۰۰۰ کاراکتر').optional(),
  items: z.array(itemSchema).min(1, 'حداقل یک قلم کالا باید ثبت شود').max(50),
});

type CreateRequestForm = z.infer<typeof createRequestSchema>;

export function CreatePurchaseRequestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      items: [{ item_name: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = useWatch({ control, name: 'items' });
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);

  const { mutate: createRequest, isPending: isCreating } = useMutation({
    mutationFn: (data: CreateRequestForm) => purchaseRequestApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      navigate(`/purchase-requests/${response.data.id}`);
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } };
      alert('خطا در ثبت درخواست: ' + (axiosError.response?.data?.error || 'خطای ناشناخته'));
    },
  });

  const onSubmit = (data: CreateRequestForm) => {
    createRequest(data);
  };

  const addItem = () => {
    append({ item_name: '', quantity: 1, unit_price: 0 });
  };

  const removeItem = (index: number) => {
    if (fields.length <= 1) return;
    remove(index);
  };

  const isSubmittingDisabled = !isDirty || isSubmitting || isCreating;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">ثبت درخواست خرید جدید</h1>
          <p className="page-subtitle">اطلاعات درخواست و اقلام را تکمیل کنید</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Request Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiFileText className="w-5 h-5 text-primary-600" />
              اطلاعات اصلی درخواست
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="عنوان درخواست *"
              placeholder="مثال: خرید لپ‌تاپ برای تیم توسعه"
              error={errors.title?.message}
              {...register('title')}
              fullWidth
            />
            <div>
              <label className="label">توضیحات</label>
              <textarea
                {...register('description')}
                rows={3}
                className={cn('input w-full', errors.description && 'input-error')}
                placeholder="توضیحات کامل‌تر درباره درخواست (اختیاری)..."
              />
              {errors.description && (
                <p className="error-message" role="alert">{errors.description.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <div className="p-6 border-b border-secondary-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-semibold text-secondary-900 flex items-center gap-2">
              <FiDollarSign className="w-5 h-5 text-primary-600" />
              اقلام درخواست
            </h3>
            <Button variant="secondary" size="sm" type="button" onClick={addItem}>
              <FiPlus className="w-4 h-4" />
              افزودن قلم
            </Button>
          </div>
          <CardContent className="p-0">
            {fields.length === 0 ? (
              <div className="empty-state p-8">
                <FiPlus className="empty-state-icon w-12 h-12" />
                <h3 className="empty-state-title">هیچ قلمی اضافه نشده</h3>
                <p className="empty-state-description">حداقل یک قلم کالا/خدمت باید ثبت شود</p>
                <Button variant="secondary" type="button" onClick={addItem} className="mt-4">
                  <FiPlus className="w-4 h-4" />
                  افزودن اولین قلم
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-secondary-200">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-white">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 min-w-0">
                        <label className="label">نام کالا/خدمت *</label>
                        <Controller
                          name={`items.${index}.item_name`}
                          control={control}
                          rules={{ required: 'نام کالا الزامی است' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              placeholder="مثال: لپ‌تاپ Dell XPS 15"
                              className={cn('input', errors.items?.[index]?.item_name && 'input-error')}
                              aria-invalid={errors.items?.[index]?.item_name ? 'true' : 'false'}
                            />
                          )}
                        />
                        {errors.items?.[index]?.item_name && (
                          <p className="error-message" role="alert">{errors.items[index].item_name.message}</p>
                        )}
                      </div>
                      <div className="w-full sm:w-32">
                        <label className="label">تعداد *</label>
                        <Controller
                          name={`items.${index}.quantity`}
                          control={control}
                          rules={{ required: 'تعداد الزامی است', min: { value: 1, message: 'حداقل ۱' } }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="number"
                              min="1"
                              max="1000000"
                              className={cn('input text-center', errors.items?.[index]?.quantity && 'input-error')}
                              aria-invalid={errors.items?.[index]?.quantity ? 'true' : 'false'}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="error-message" role="alert">{errors.items[index].quantity.message}</p>
                        )}
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="label">قیمت واحد (تومان) *</label>
                        <Controller
                          name={`items.${index}.unit_price`}
                          control={control}
                          rules={{ required: 'قیمت واحد الزامی است', min: { value: 1, message: 'حداقل ۱ تومان' } }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="number"
                              min="1"
                              step="1000"
                              className={cn('input text-left', errors.items?.[index]?.unit_price && 'input-error')}
                              aria-invalid={errors.items?.[index]?.unit_price ? 'true' : 'false'}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                        {errors.items?.[index]?.unit_price && (
                          <p className="error-message" role="alert">{errors.items[index].unit_price.message}</p>
                        )}
                      </div>
                      <div className="w-full sm:w-40 text-left pt-6 sm:pt-0 sm:self-end">
                        <label className="label">مبلغ کل</label>
                        <div className="px-4 py-2.5 bg-secondary-50 rounded-lg text-lg font-bold text-primary-600">
                          {formatCurrency((items[index]?.quantity || 0) * (items[index]?.unit_price || 0))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={fields.length <= 1}
                        className="pt-6 sm:pt-0 sm:self-end text-secondary-400 hover:text-danger-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`حذف قلم ${index + 1}`}
                      >
                        <FiX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
              <span className="text-secondary-500">تعداد اقلام: {fields.length}</span>
              <div className="flex items-center gap-4 text-left sm:text-right">
                <span className="text-secondary-600">مبلغ کل:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-secondary-50/80 backdrop-blur-sm py-4 px-4 rounded-xl border border-secondary-200">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            <FiArrowLeft className="w-4 h-4" />
            انصراف
          </Button>
          <Button type="submit" loading={isCreating || isSubmitting} disabled={isSubmittingDisabled}>
            <FiCheck className="w-4 h-4" />
            ثبت درخواست خرید
          </Button>
        </div>
      </form>
    </div>
  );
}