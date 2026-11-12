'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  disabled?: boolean;
  size?: number;
  label?: string;
}

export function StarRating({
  value,
  onChange,
  disabled = false,
  size = 24,
  label = 'Rating',
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => !disabled && setHoverValue(null)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'ArrowRight' && star < 5) onChange?.(star + 1);
            if (e.key === 'ArrowLeft' && star > 1) onChange?.(star - 1);
          }}
          className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            disabled ? 'cursor-default opacity-80' : 'cursor-pointer hover:scale-110'
          }`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          role="radio"
          aria-checked={value === star}
        >
          <Star
            size={size}
            className={`${
              star <= displayValue
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-300 dark:text-gray-600'
            } transition-colors`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {value}/5
        </span>
      )}
    </div>
  );
}

