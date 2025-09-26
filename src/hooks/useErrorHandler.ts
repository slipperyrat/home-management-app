'use client';

import { useState, useCallback } from 'react';

export interface ErrorState {
  error: string | null;
  hasError: boolean;
}

export interface ErrorHandler {
  error: string | null;
  hasError: boolean;
  handleError: (error: Error | string) => void;
  clearError: () => void;
  setError: (error: string | null) => void;
}

export function useErrorHandler(): ErrorHandler {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    hasError: false
  });

  const handleError = useCallback((error: Error | string) => {
    const errorMessage = error instanceof Error ? error.message : error;
    
    setErrorState({
      error: errorMessage,
      hasError: true
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Component error:', error);
    }

    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // You can integrate with Sentry, LogRocket, etc. here
      console.error('Production error:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      hasError: false
    });
  }, []);

  const setError = useCallback((error: string | null) => {
    setErrorState({
      error,
      hasError: error !== null
    });
  }, []);

  return {
    error: errorState.error,
    hasError: errorState.hasError,
    handleError,
    clearError,
    setError
  };
}

// Hook for handling async operations with error states
export function useAsyncError() {
  const { error, hasError, handleError, clearError } = useErrorHandler();
  const [isLoading, setIsLoading] = useState(false);

  const executeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      clearError();
      
      const result = await asyncFn();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      handleError(errorObj);
      
      if (onError) {
        onError(errorObj);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, clearError]);

  return {
    error,
    hasError,
    isLoading,
    executeAsync,
    clearError
  };
}
