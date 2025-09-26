'use client';

import React, { Suspense, lazy, ComponentType } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface LazyPageWrapperProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}

// Higher-order component for lazy loading pages
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(() => 
    Promise.resolve({ default: Component })
  );

  return function LazyPageWrapper(props: P & LazyPageWrapperProps) {
    const { fallback: customFallback, errorFallback, ...componentProps } = props;
    
    const defaultFallback = fallback || customFallback || (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading page..." />
      </div>
    );

    return (
      <ErrorBoundary fallback={errorFallback}>
        <Suspense fallback={defaultFallback}>
          <LazyComponent {...(componentProps as P)} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

// Hook for lazy loading components
export function useLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const [Component, setComponent] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    importFn()
      .then((module) => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [importFn]);

  if (loading) {
    return { Component: null, loading: true, error: null, fallback };
  }

  if (error) {
    return { Component: null, loading: false, error, fallback };
  }

  return { Component, loading: false, error: null, fallback };
}

// Lazy page wrapper component
export function LazyPageWrapper({ 
  children, 
  fallback, 
  errorFallback 
}: LazyPageWrapperProps & { children: React.ReactNode }) {
  const defaultFallback = fallback || (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" text="Loading page..." />
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={defaultFallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Preload function for critical pages
export function preloadPage(importFn: () => Promise<any>) {
  return importFn();
}

// Lazy page components with optimized loading
export const LazyDashboard = withLazyLoading(
  lazy(() => import('@/app/dashboard/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading dashboard..." />
  </div>
);

export const LazyShoppingLists = withLazyLoading(
  lazy(() => import('@/app/shopping-lists/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading shopping lists..." />
  </div>
);

export const LazyChores = withLazyLoading(
  lazy(() => import('@/app/chores/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading chores..." />
  </div>
);

export const LazyMealPlanner = withLazyLoading(
  lazy(() => import('@/app/meal-planner/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading meal planner..." />
  </div>
);

export const LazyRecipes = withLazyLoading(
  lazy(() => import('@/app/recipes/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading recipes..." />
  </div>
);

export const LazyCalendar = withLazyLoading(
  lazy(() => import('@/app/calendar/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading calendar..." />
  </div>
);

export const LazyBills = withLazyLoading(
  lazy(() => import('@/app/bills/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading bills..." />
  </div>
);

export const LazyRewards = withLazyLoading(
  lazy(() => import('@/app/rewards/page')),
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" text="Loading rewards..." />
  </div>
);

// Lazy component components
export const LazyPWAInstallPrompt = lazy(() => import('@/components/PWAInstallPrompt'));
export const LazyPWAStatus = lazy(() => import('@/components/PWAStatus'));
export const LazyPushNotificationSetup = lazy(() => import('@/components/PushNotificationSetup'));
export const LazyHeartbeatProvider = lazy(() => import('@/components/HeartbeatProvider'));

// Lazy heavy components
export const LazyErrorBoundary = lazy(() => import('@/components/ErrorBoundary'));
export const LazyNavBar = lazy(() => import('@/components/NavBar'));
export const LazySyncUserClient = lazy(() => import('@/components/SyncUserClient'));
