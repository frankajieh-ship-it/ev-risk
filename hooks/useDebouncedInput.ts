/**
 * Report Rendering Stability - Debounced Input Hook
 *
 * Purpose: Prevent "re-render storms" during typing
 * Problem: Every keystroke triggers report recomposition, causing jank
 * Solution: Use useTransition to defer updates in low priority
 */

import { useState, useTransition, useCallback } from "react";

/**
 * Hook for debounced input with useTransition
 *
 * @param initialValue - Initial value
 * @param onCommit - Callback when value is committed
 * @returns [currentValue, setValue, isPending]
 */
export function useDebouncedInput<T>(
  initialValue: T,
  onCommit: (value: T) => void
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback(
    (newValue: T) => {
      // Update local state immediately (keeps UI responsive)
      setValue(newValue);

      // Commit to parent in low priority (prevents jank)
      startTransition(() => {
        onCommit(newValue);
      });
    },
    [onCommit]
  );

  return [value, handleChange, isPending];
}

/**
 * Hook for debounced text input
 *
 * Optimized for form fields
 */
export function useDebouncedText(
  initialValue: string,
  onCommit: (value: string) => void
): {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isPending: boolean;
} {
  const [value, setValue, isPending] = useDebouncedInput(initialValue, onCommit);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [setValue]
  );

  return {
    value,
    onChange: handleChange,
    isPending,
  };
}

/**
 * Hook for debounced number input
 *
 * Optimized for numeric fields
 */
export function useDebouncedNumber(
  initialValue: number,
  onCommit: (value: number) => void
): {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
} {
  const [value, setValue, isPending] = useDebouncedInput(initialValue, onCommit);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = parseInt(e.target.value, 10);
      if (!isNaN(numValue)) {
        setValue(numValue);
      }
    },
    [setValue]
  );

  return {
    value,
    onChange: handleChange,
    isPending,
  };
}

/**
 * Hook for debounced boolean input (checkbox, toggle)
 */
export function useDebouncedBoolean(
  initialValue: boolean,
  onCommit: (value: boolean) => void
): {
  value: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
} {
  const [value, setValue, isPending] = useDebouncedInput(initialValue, onCommit);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.checked);
    },
    [setValue]
  );

  return {
    value,
    onChange: handleChange,
    isPending,
  };
}

/**
 * Example usage in form field:
 *
 * ```tsx
 * function PersonalizationField() {
 *   const { value, onChange, isPending } = useDebouncedText("", (val) => {
 *     updateReport({ dailyMiles: parseInt(val) });
 *   });
 *
 *   return (
 *     <input
 *       type="text"
 *       value={value}
 *       onChange={onChange}
 *       className={isPending ? "opacity-70" : ""}
 *     />
 *   );
 * }
 * ```
 */
