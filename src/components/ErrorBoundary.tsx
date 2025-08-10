'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and external service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Send to Sentry for error tracking
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error, { 
          extra: {
            componentStack: errorInfo.componentStack,
            errorBoundary: 'ErrorBoundary'
          },
          tags: { component: 'ErrorBoundary' }
        });
      });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent 
          error={this.state.error!} 
          resetError={this.resetError} 
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-4">
        We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
      </p>
      
      {process.env.NODE_ENV === 'development' && (
        <details className="mb-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Error details (development only)
          </summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
            {error.message}
            {error.stack && '\n\n' + error.stack}
          </pre>
        </details>
      )}
      
      <div className="space-y-2">
        <button
          onClick={resetError}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Reload page
        </button>
      </div>
    </div>
  </div>
);

// Specialized error boundary for specific features
export const FeatureErrorBoundary = ({ children, featureName }: { children: ReactNode; featureName: string }) => (
  <ErrorBoundary
    fallback={({ error, resetError }) => (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <div className="flex items-center">
          <div className="text-red-500 mr-3">⚠️</div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">
              {featureName} Error
            </h3>
            <p className="text-sm text-red-700 mt-1">
              This feature is temporarily unavailable. Other parts of the app should still work.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-red-600 mt-2 font-mono">
                {error.message}
              </p>
            )}
          </div>
          <button
            onClick={resetError}
            className="ml-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )}
    onError={(error, errorInfo) => {
      console.error(`${featureName} error:`, error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for handling async errors in components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Async error caught:', error, errorInfo);
    
    // Send to Sentry for error tracking
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error, { 
          extra: errorInfo,
          tags: { component: 'AsyncErrorHandler' }
        });
      });
    }
  };
};
