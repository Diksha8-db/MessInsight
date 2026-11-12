'use client';

import React from 'react';
import { StarRating } from './StarRating';
import { IFeedback } from '@/server/models/Feedback';
import { Clock, ShieldAlert, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

interface FeedbackCardProps {
  feedback: Partial<IFeedback> & { _id: string; createdAt?: string | Date };
  onEdit?: (feedback: any) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
}

export function FeedbackCard({
  feedback,
  onEdit,
  onDelete,
  canEdit = false,
}: FeedbackCardProps) {
  const isPending = feedback.sentiment?.status === 'PENDING';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div>
          <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {feedback.mealType}
          </span>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {feedback.serviceDate}
          </span>
          {feedback.isAnonymous && (
            <span className="ml-2 inline-flex items-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              Anonymous
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sentiment Status Badge */}
          {isPending ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
              <Clock size={12} /> NLP Pending
            </span>
          ) : feedback.sentiment?.status === 'DONE' ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={12} /> {feedback.sentiment.label}
            </span>
          ) : null}

          {canEdit && onEdit && (
            <button
              onClick={() => onEdit(feedback)}
              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded dark:text-gray-400 dark:hover:text-blue-400"
              title="Edit feedback"
            >
              <Edit2 size={16} />
            </button>
          )}

          {canEdit && onDelete && (
            <button
              onClick={() => onDelete(feedback._id)}
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded dark:text-gray-400 dark:hover:text-red-400"
              title="Delete feedback"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
          Overall Satisfaction
        </div>
        <StarRating value={feedback.overallRating || 0} disabled size={20} />
      </div>

      {feedback.comments && (
        <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
          <p className="whitespace-pre-wrap">{feedback.comments}</p>
        </div>
      )}

      {feedback.imageUrl && (
        <div>
          <img
            src={feedback.imageUrl}
            alt="Feedback attachment"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}

