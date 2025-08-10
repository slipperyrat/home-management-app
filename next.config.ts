import {withSentryConfig} from "@sentry/nextjs";
import withPWA from "next-pwa";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Exclude Supabase Edge Functions from the build
  webpack: (config, { isServer }) => {
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
    
    return newConfig;
  },
  // Additional build exclusions
  distDir: '.next',
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false, // Enable PWA in development for notifications
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
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
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});