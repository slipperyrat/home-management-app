import {withSentryConfig} from "@sentry/nextjs";
import withPWA from "next-pwa";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
  
  // Build optimizations
  distDir: '.next',
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['@clerk/nextjs', '@supabase/supabase-js'],
  },
  
  // Turbopack configuration (moved from experimental)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Webpack optimizations
  webpack: (config, { isServer, dev }) => {
    // Create a new config object to avoid read-only property issues
    const newConfig = { ...config };
    
    // Ignore Supabase functions directory completely
    if (newConfig.watchOptions) {
      newConfig.watchOptions = {
        ...newConfig.watchOptions,
        ignored: [
          ...(Array.isArray(newConfig.watchOptions.ignored) ? newConfig.watchOptions.ignored : []),
          '**/supabase/functions/**',
        ],
      };
    } else {
      newConfig.watchOptions = {
        ignored: ['**/supabase/functions/**'],
      };
    }
    
    // Production optimizations
    if (!dev && !isServer) {
      // Optimize bundle splitting
      newConfig.optimization = {
        ...newConfig.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000, // 244KB limit per chunk
          cacheGroups: {
            // Core framework chunks
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'framework',
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // UI library chunks
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|@heroicons|sonner)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 30,
            },
            // Clerk authentication
            clerk: {
              test: /[\\/]node_modules[\\/]@clerk[\\/]/,
              name: 'clerk',
              chunks: 'async', // Lazy load
              priority: 25,
              maxSize: 200000, // 200KB limit
            },
            // Supabase database
            supabase: {
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              name: 'supabase',
              chunks: 'async', // Lazy load
              priority: 25,
              maxSize: 150000, // 150KB limit
            },
            // Analytics and monitoring
            analytics: {
              test: /[\\/]node_modules[\\/](@vercel|@sentry)[\\/]/,
              name: 'analytics',
              chunks: 'async',
              priority: 20,
            },
            // Other vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              maxSize: 244000, // 244KB limit
            },
          },
        },
        // Enable tree shaking
        usedExports: true,
        sideEffects: false,
      };
    }
    
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('@next/bundle-analyzer');
      newConfig.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-analysis.html',
        })
      );
    }
    
    return newConfig;
  },
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development' && !process.env.ENABLE_PWA_DEV,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'supabaseCache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.clerk\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'clerkCache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
  ],
  fallbacks: {
    document: '/offline',
  },
  // Better PWA configuration
  sw: 'sw.js',
  dynamicStartUrl: false,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
})(nextConfig as any);

export default withSentryConfig(pwaConfig, {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "home-management-app",
project: "javascript-nextjs",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/monitoring",

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/javascript/guides/nextjs/manual-setup/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});