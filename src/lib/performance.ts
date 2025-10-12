// Performance monitoring utilities
import { useEffect } from 'react';
import { logger } from '@/lib/logging/logger';

// Type definitions for Performance API interfaces
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart?: number;
  processingEnd?: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private marks: Map<string, number> = new Map();

  /**
   * Start timing a performance metric
   */
  start(name: string, metadata?: Record<string, unknown>): void {
    if (this.metrics.has(name)) {
      logger.warn('Performance metric already exists, overwriting', { name });
    }
    
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      ...(metadata && { metadata })
    });
  }

  /**
   * End timing a performance metric
   */
  end(name: string): PerformanceMetric | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn('Performance metric not found', { name });
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    return metric;
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Measure time between two marks
   */
  measure(_name: string, startMark: string, endMark: string): number | null {
    const startTime = this.marks.get(startMark);
    const endTime = this.marks.get(endMark);
    
    if (!startTime || !endTime) {
      logger.warn('Performance mark not found', { startMark, endMark });
      return null;
    }
    
    return endTime - startTime;
  }

  /**
   * Get all completed metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.marks.clear();
  }

  /**
   * Log all metrics to console
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    if (metrics.length === 0) {
    logger.info('No performance metrics to log');
      return;
    }

    metrics.forEach(metric => {
      logger.info('Performance metric', {
        name: metric.name,
        duration: metric.duration?.toFixed(2),
        metadata: metric.metadata,
      });
    });
  }

  /**
   * Initialize performance monitoring
   */
  init(): void {
    if (typeof window === 'undefined') return;

    // Monitor Core Web Vitals
    try {
      // Monitor Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.mark('lcp');
          logger.info('LCP observed', { startTime: entry.startTime });
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      logger.warn('Failed to observe LCP', error as Error);
    }

    try {
      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.mark('fid');
          const fidEntry = entry as PerformanceEventTiming;
          if (fidEntry.processingStart) {
            logger.info('FID observed', {
              duration: fidEntry.processingStart - fidEntry.startTime,
            });
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      logger.warn('Failed to observe FID', error as Error);
    }

    try {
      // Monitor Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as LayoutShift;
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        }
        performanceMonitor.mark('cls');
        logger.info('CLS observed', { value: clsValue });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      logger.warn('Failed to observe CLS', error as Error);
    }

    try {
      // Monitor First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.mark('fcp');
          logger.info('FCP observed', { startTime: entry.startTime });
        });
      });
      fcpObserver.observe({ entryTypes: ['first-contentful-paint'] });
    } catch (error) {
      logger.warn('Failed to observe FCP', error as Error);
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize monitoring when module is imported
if (typeof window !== 'undefined') {
  performanceMonitor.init();
}

// React performance hooks
export function usePerformanceMeasure(name: string, dependencies: unknown[] = []) {
  useEffect(() => {
    performanceMonitor.start(name);

    return () => {
      performanceMonitor.end(name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

// Enhanced performance monitoring for PWA
export class PWAPerformanceMonitor {
  private static instance: PWAPerformanceMonitor;
  private metrics: Map<string, Record<string, unknown>> = new Map();

  static getInstance(): PWAPerformanceMonitor {
    if (!PWAPerformanceMonitor.instance) {
      PWAPerformanceMonitor.instance = new PWAPerformanceMonitor();
    }
    return PWAPerformanceMonitor.instance;
  }

  // Track PWA-specific metrics
  trackPWAInstall(outcome: 'accepted' | 'dismissed') {
    this.metrics.set('pwa_install', {
      outcome,
      timestamp: Date.now(),
    });
    logger.info('PWA install event recorded', { outcome });
  }

  trackOfflineUsage(feature: string, duration: number) {
    this.metrics.set(`offline_${feature}`, {
      feature,
      duration,
      timestamp: Date.now(),
    });
    logger.info('Offline usage event recorded', { feature, duration });
  }

  trackBundleLoadTime(bundle: string, loadTime: number) {
    this.metrics.set(`bundle_${bundle}`, {
      bundle,
      loadTime,
      timestamp: Date.now(),
    });
    logger.info('Bundle load event recorded', { bundle, loadTime });
  }

  trackCacheHitRate(cache: string, hitRate: number) {
    this.metrics.set(`cache_${cache}`, {
      cache,
      hitRate,
      timestamp: Date.now(),
    });
    logger.info('Cache hit rate recorded', { cache, hitRate });
  }

  // Get all metrics
  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // Clear metrics
  clearMetrics() {
    this.metrics.clear();
  }
}

// Export singleton instance
export const pwaPerformanceMonitor = PWAPerformanceMonitor.getInstance();

// Enhanced performance hooks
export function usePWAPerformance() {
  const trackInstall = (outcome: 'accepted' | 'dismissed') => {
    pwaPerformanceMonitor.trackPWAInstall(outcome);
  };

  const trackOfflineUsage = (feature: string, duration: number) => {
    pwaPerformanceMonitor.trackOfflineUsage(feature, duration);
  };

  const trackBundleLoad = (bundle: string, loadTime: number) => {
    pwaPerformanceMonitor.trackBundleLoadTime(bundle, loadTime);
  };

  const trackCacheHit = (cache: string, hitRate: number) => {
    pwaPerformanceMonitor.trackCacheHitRate(cache, hitRate);
  };

  return {
    trackInstall,
    trackOfflineUsage,
    trackBundleLoad,
    trackCacheHit,
    getAllMetrics: () => pwaPerformanceMonitor.getAllMetrics(),
  };
}