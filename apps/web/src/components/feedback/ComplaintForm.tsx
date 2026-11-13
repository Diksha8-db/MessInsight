'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/apiClient';
import { ComplaintCategory, ComplaintPriority } from '@/types/complaint';
import { AlertCircle, CheckCircle, Upload, X } from 'lucide-react';

const complaintSchema = z.object({
  category: z.nativeEnum(ComplaintCategory),
  priority: z.nativeEnum(ComplaintPriority),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
});

type ComplaintFormData = z.infer<typeof complaintSchema>;

interface ComplaintFormProps {
  messId: string;
  onSuccess?: () => void;
}

export function ComplaintForm({ messId, onSuccess }: ComplaintFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ComplaintFormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      category: ComplaintCategory.FOOD_HYGIENE,
      priority: ComplaintPriority.MEDIUM,
      title: '',
      description: '',
    },
  });

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

  const onSubmit = async (data: ComplaintFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let uploadedUrl: string | null = null;

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

      await apiClient.post('/api/student/complaints', {
        messId,
        category: data.category,
        priority: data.priority,
        title: data.title,
        description: data.description,
        imageUrl: uploadedUrl,
      });

      setSuccessMessage('Complaint registered successfully! The mess management will review it.');
      reset();
      removeImage();
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5"
    >
      <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Register a Mess Complaint
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Issues regarding food safety, cleanliness, water, or service.
        </p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category *
          </label>
          <select
            {...register('category')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="FOOD_HYGIENE">Food Hygiene</option>
            <option value="WATER_QUALITY">Water Quality</option>
            <option value="CONTAMINATION">Foreign Particle / Contamination</option>
            <option value="CLEANLINESS">Dining Hall Cleanliness</option>
            <option value="FOOD_STORAGE">Food Storage / Stale Food</option>
            <option value="OTHER">Other Issues</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Urgency / Priority *
          </label>
          <select
            {...register('priority')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High (Requires prompt action)</option>
            <option value="URGENT">Urgent (Health/Safety hazard)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title *
        </label>
        <input
          {...register('title')}
          placeholder="Brief summary of the problem"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Detailed Description *
        </label>
        <textarea
          {...register('description')}
          rows={4}
          placeholder="Include what occurred, exact location/dish, time, and any affected students..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        />
        {errors.description && (
          <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Supporting Photo (Optional)
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
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 w-fit">
            <Upload size={16} />
            <span>Upload Photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 shadow-sm"
      >
        {isSubmitting ? 'Registering Complaint...' : 'Register Complaint'}
      </button>
    </form>
  );
}
