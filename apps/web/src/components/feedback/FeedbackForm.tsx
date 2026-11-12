'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StarRating } from './StarRating';
import { apiClient } from '@/lib/apiClient';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';

const feedbackFormSchema = z.object({
  overallRating: z.number().int().min(1, 'Please select an overall rating').max(5),
  comments: z.string().max(1000, 'Comments cannot exceed 1000 characters').optional(),
  isAnonymous: z.boolean(),
  createHygieneComplaint: z.boolean(),
  complaintTitle: z.string().optional(),
  complaintDescription: z.string().optional(),
});

type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

interface DishItem {
  dishId: string;
  name: string;
  category: string;
  isAvailable: boolean;
}

interface FeedbackFormProps {
  menuId: string;
  messId: string;
  mealType: string;
  serviceDate: string;
  dishes: DishItem[];
  onSuccess?: () => void;
}

export function FeedbackForm({
  menuId,
  messId,
  mealType,
  serviceDate,
  dishes,
  onSuccess,
}: FeedbackFormProps) {
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      overallRating: 0,
      comments: '',
      isAnonymous: false,
      createHygieneComplaint: false,
    },
  });

  const commentsValue = watch('comments') || '';
  const createHygiene = watch('createHygieneComplaint');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Please upload a valid JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file must be under 5MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let uploadedUrl: string | null = null;

      // 1. Upload image if attached
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadRes = await fetch('/api/student/feedback/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const resJson = await uploadRes.json();
          if (resJson.success && resJson.data?.url) {
            uploadedUrl = resJson.data.url;
          }
        }
      }

      // 2. Prepare dish ratings payload
      const formattedDishRatings = Object.entries(dishRatings)
        .filter(([_, rating]) => rating > 0)
        .map(([dishId, rating]) => ({ dishId, rating }));

      // 3. Submit feedback with idempotencyKey
      const idempotencyKey = crypto.randomUUID();
      const feedbackPayload = {
        menuId,
        overallRating: data.overallRating,
        dishRatings: formattedDishRatings,
        comments: data.comments?.trim() || null,
        imageUrl: uploadedUrl,
        isAnonymous: data.isAnonymous,
        idempotencyKey,
      };

      const res = await apiClient.post<any>('/api/student/feedback', feedbackPayload);

      // 4. Optionally create linked hygiene complaint
      if (data.createHygieneComplaint && data.complaintTitle && data.complaintDescription) {
        await apiClient.post('/api/student/complaints', {
          messId,
          category: 'FOOD_HYGIENE',
          priority: 'HIGH',
          title: data.complaintTitle,
          description: data.complaintDescription,
          imageUrl: uploadedUrl,
          feedbackId: res.data?.id || res.data?._id,
        });
      }

      setSuccessMessage('Thank you! Your feedback has been submitted successfully.');
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
    >
      <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Meal Feedback: {mealType}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Date: {serviceDate}</p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Overall Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Overall Meal Rating *
        </label>
        <Controller
          control={control}
          name="overallRating"
          render={({ field }) => (
            <StarRating
              value={field.value}
              onChange={field.onChange}
              size={28}
              label="Overall Meal Rating"
            />
          )}
        />
        {errors.overallRating && (
          <p className="text-xs text-red-500 mt-1">{errors.overallRating.message}</p>
        )}
      </div>

      {/* Per-Dish Ratings */}
      {dishes.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Rate Individual Dishes (Optional)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dishes.map((dish) => (
              <div
                key={dish.dishId}
                className={`p-3 rounded-lg border ${
                  dish.isAvailable
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                    : 'border-dashed border-gray-300 bg-gray-100 dark:bg-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {dish.name}
                  </span>
                  {!dish.isAvailable && (
                    <span className="text-[10px] text-red-600 bg-red-100 dark:bg-red-950 px-1.5 py-0.5 rounded">
                      Unavailable
                    </span>
                  )}
                </div>
                <StarRating
                  value={dishRatings[dish.dishId] || 0}
                  onChange={(val) =>
                    setDishRatings((prev) => ({ ...prev, [dish.dishId]: val }))
                  }
                  disabled={!dish.isAvailable}
                  size={18}
                  label={`Rate ${dish.name}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Comments & Feedback
          </label>
          <span
            className={`text-xs ${
              commentsValue.length > 950 ? 'text-amber-500 font-semibold' : 'text-gray-400'
            }`}
          >
            {commentsValue.length}/1000
          </span>
        </div>
        <textarea
          {...register('comments')}
          rows={3}
          maxLength={1000}
          placeholder="Share your thoughts on the taste, portion, temperature, or quality..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        {errors.comments && (
          <p className="text-xs text-red-500">{errors.comments.message}</p>
        )}
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Attach Photo (Optional, JPEG/PNG/WebP, max 5MB)
        </label>
        {imagePreview ? (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-24 h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 w-fit">
            <Upload size={16} />
            <span>Select Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Anonymous Checkbox */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="isAnonymous"
          {...register('isAnonymous')}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
        />
        <label htmlFor="isAnonymous" className="text-sm text-gray-700 dark:text-gray-300">
          Submit feedback anonymously (your name and ID will not be visible to the mess manager)
        </label>
      </div>

      {/* Hygiene Complaint Checkbox & Section */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="createHygieneComplaint"
            {...register('createHygieneComplaint')}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
          />
          <label
            htmlFor="createHygieneComplaint"
            className="text-sm font-medium text-red-600 dark:text-red-400"
          >
            Report an urgent Food Hygiene or Contamination issue
          </label>
        </div>

        {createHygiene && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                Complaint Title *
              </label>
              <input
                {...register('complaintTitle')}
                placeholder="e.g. Foreign object in dal, undercooked rice"
                className="w-full px-3 py-1.5 border border-red-300 dark:border-red-800 rounded text-sm bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                Detailed Hygiene Description *
              </label>
              <textarea
                {...register('complaintDescription')}
                rows={2}
                placeholder="Describe what occurred, foreign particles found, symptoms, etc."
                className="w-full px-3 py-1.5 border border-red-300 dark:border-red-800 rounded text-sm bg-white dark:bg-gray-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSubmitting ? 'Submitting Feedback...' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  );
}
