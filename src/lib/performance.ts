// Performance monitoring utilities
import { useEffect } from 'react';

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
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private marks: Map<string, number> = new Map();

  /**
   * Start timing a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (this.metrics.has(name)) {
      console.warn(`Performance metric "${name}" already exists, overwriting`);
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
      console.warn(`Performance metric "${name}" not found`);
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
      console.warn(`Mark "${startMark}" or "${endMark}" not found`);
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
      console.log('No performance metrics to log');
      return;
    }

    console.group('Performance Metrics');
    metrics.forEach(metric => {
      console.log(`${metric.name}: ${metric.duration?.toFixed(2)}ms`, metric.metadata || '');
    });
    console.groupEnd();
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
          console.log('LCP:', entry.startTime);
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('Failed to observe LCP:', error);
    }

    try {
      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.mark('fid');
          const fidEntry = entry as PerformanceEventTiming;
          if (fidEntry.processingStart) {
            console.log('FID:', fidEntry.processingStart - fidEntry.startTime);
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.warn('Failed to observe FID:', error);
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
        console.log('CLS:', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('Failed to observe CLS:', error);
    }

    try {
      // Monitor First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.mark('fcp');
          console.log('FCP:', entry.startTime);
        });
      });
      fcpObserver.observe({ entryTypes: ['first-contentful-paint'] });
    } catch (error) {
      console.warn('Failed to observe FCP:', error);
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
export function usePerformanceMeasure(name: string, dependencies: any[] = []) {
  useEffect(() => {
    performanceMonitor.start(name);
    
    return () => {
      performanceMonitor.end(name);
    };
  }, dependencies);
}
