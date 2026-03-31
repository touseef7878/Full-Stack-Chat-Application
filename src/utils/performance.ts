// PERFORMANCE UTILITIES - WhatsApp-level optimizations

// Debounce function for high-frequency events
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func(...args);
    }, wait);
    
    if (callNow) func(...args);
  };
};

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memoization with TTL
export const memoizeWithTTL = <T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 60000 // 1 minute default
): T => {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < ttl) {
      return cached.value;
    }
    
    const result = fn(...args);
    cache.set(key, { value: result, timestamp: now });
    
    // Cleanup old entries
    if (cache.size > 100) {
      const entries = Array.from(cache.entries());
      entries.forEach(([k, v]) => {
        if (now - v.timestamp > ttl) {
          cache.delete(k);
        }
      });
    }
    
    return result;
  }) as T;
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver => {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  };
  
  return new IntersectionObserver(callback, defaultOptions);
};

// Batch DOM updates
export const batchDOMUpdates = (callback: () => void): void => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, { timeout: 100 });
  } else {
    requestAnimationFrame(callback);
  }
};

// Memory usage monitoring
export const getMemoryUsage = (): MemoryInfo | null => {
  if ('memory' in performance) {
    return (performance as any).memory;
  }
  return null;
};

// Connection quality detection
export const getConnectionQuality = (): 'slow' | 'fast' | 'unknown' => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection.effectiveType) {
      return ['slow-2g', '2g', '3g'].includes(connection.effectiveType) ? 'slow' : 'fast';
    }
  }
  return 'unknown';
};

// Preload critical resources
export const preloadResource = (href: string, as: string, crossorigin?: string): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (crossorigin) link.crossOrigin = crossorigin;
  document.head.appendChild(link);
};

// Service Worker registration
export const registerServiceWorker = async (swPath: string): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(swPath);
      console.log('SW registered:', registration);
      return registration;
    } catch (error) {
      console.log('SW registration failed:', error);
      return null;
    }
  }
  return null;
};

// Image optimization
export const optimizeImage = (
  src: string,
  width?: number,
  height?: number,
  quality = 80
): string => {
  // For production, you'd integrate with a service like Cloudinary or ImageKit
  // This is a placeholder for the optimization logic
  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());
  
  return `${src}?${params.toString()}`;
};

// Bundle size analyzer
export const analyzeBundleSize = (): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Bundle analyzer would be available in production build');
  }
};

// Performance metrics collection
export const collectPerformanceMetrics = (): Record<string, number> => {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');
  
  const metrics: Record<string, number> = {
    // Navigation timing
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    
    // Network timing
    dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcpConnect: navigation.connectEnd - navigation.connectStart,
    
    // Request/Response timing
    requestTime: navigation.responseStart - navigation.requestStart,
    responseTime: navigation.responseEnd - navigation.responseStart,
    
    // Processing timing
    domProcessing: navigation.domComplete - navigation.domLoading,
  };
  
  // Paint timing
  paint.forEach((entry) => {
    metrics[entry.name.replace('-', '')] = entry.startTime;
  });
  
  return metrics;
};

// React performance profiler
export const profileComponent = (id: string, phase: 'mount' | 'update', actualDuration: number): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Component ${id} ${phase} took ${actualDuration}ms`);
  }
};

// Lazy loading utility
export const lazyLoad = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  const React = require('react');
  return React.lazy(() => 
    importFunc().catch(() => ({ 
      default: fallback || (() => React.createElement('div', null, 'Loading failed...')) 
    }))
  );
};

// Critical CSS inlining
export const inlineCriticalCSS = (css: string): void => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
};

// Resource hints
export const addResourceHints = (): void => {
  // DNS prefetch for external domains
  const dnsPrefetch = ['//fonts.googleapis.com', '//api.dicebear.com'];
  dnsPrefetch.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });
  
  // Preconnect to critical origins
  const preconnect = ['//fonts.gstatic.com'];
  preconnect.forEach(origin => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
};