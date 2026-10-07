/**
 * @fileOverview Custom debounce hook for delaying state updates
 * 
 * @uses react - For useState and useEffect hooks
 */
import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a value and provides pending state
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Array} - [debouncedValue, isPending]
 */
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (value !== debouncedValue) {
      setIsPending(true);
    }

    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setIsPending(false);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, debouncedValue]);

  return [debouncedValue, isPending];
};

export default useDebounce;