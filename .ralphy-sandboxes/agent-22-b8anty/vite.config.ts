/// <reference types="vitest" />
/**
 * Vite Build Configuration
 * New York Minute NYC E-Commerce Platform
 * 
 * Built by WebFlow Studios Team (2024)
 * Build Engineer: James Martinez
 * Performance Optimization: Sarah Chen
 * 
 * Build Targets: ES2020+ (Modern browsers only)
 * Bundler: Rollup with manual chunk splitting
 * Compression: Brotli + Gzip
 * PWA: Service Worker with Workbox
 * 
 * Security Features:
 * - Production console.log removal
 * - Source map obfuscation
 * - Terser minification with dead code elimination
 * 
 * Contact: contact@webflowstudios.dev
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execSync } from 'child_process';
import { deferCssPlugin } from "./vite-plugins/defer-css";
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { buildTimestampPlugin } from './vite-plugins/build-timestamp';
import { realtimeValidationPlugin } from './vite-plugins/realtime-validation';
import { versionGeneratorPlugin } from './vite-plugins/version-generator';

// Backend env fallbacks for preview/dev environments.
// These are *public* values (URL + anon/publishable key) and prevent the app from hard-crashing
// when the platform doesn't inject VITE_SUPABASE_* into the frontend build.
const FALLBACK_BACKEND = {
  url: 'https://aejugtmhwwknrowfyzie.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlanVndG1od3drbnJvd2Z5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDA4OTcsImV4cCI6MjA3NzQxNjg5N30.R7S5uyha_U5oNc1IBXt8bThumQJSa8FuJZdgiWRgwek',
  projectId: 'aejugtmhwwknrowfyzie',
} as const;

// Sitemap generator plugin
function sitemapPlugin() {
  return {
    name: "sitemap-generator",
    buildEnd: () => {
      console.log("Running sitemap generator...");
      try {
        // Use tsx to run TypeScript directly
        execSync("npx tsx src/lib/generate-sitemap.ts", { stdio: "inherit" });
      } catch (error) {
        console.error("Failed to generate sitemap:", error);
        // Don't fail the build if sitemap generation fails
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Content Security Policy - Critical security header
      // Development: Allows Vite HMR and all Supabase connections
      // Production: Stricter policy (configured in vercel.json and _headers)
      // Added worker-src and child-src for Mapbox Web Workers
      'Content-Security-Policy': mode === 'development'
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://cdn.gpteng.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com https://*.mapbox.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data: https://api.mapbox.com https://*.mapbox.com; connect-src 'self' http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com; worker-src blob: 'self'; child-src blob: 'self'; frame-ancestors 'self' https://lovable.dev https://*.lovable.app https://*.lovableproject.com; base-uri 'self'; form-action 'self'; object-src 'none';"
        : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://cdn.gpteng.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com https://*.mapbox.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data: https://api.mapbox.com https://*.mapbox.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com; worker-src blob: 'self'; child-src blob: 'self'; frame-ancestors 'self' https://lovable.dev https://*.lovable.app https://*.lovableproject.com; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;",
      // Additional security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    },
  },
  define: {
    // Ensure frontend always has backend env vars available.
    // If the host environment provides them, we use those; otherwise we fall back.
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || FALLBACK_BACKEND.url),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(process.env.VITE_SUPABASE_PROJECT_ID || FALLBACK_BACKEND.projectId),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_BACKEND.anonKey),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_BACKEND.anonKey
    ),
    'BUILD_TIMESTAMP': JSON.stringify(Date.now().toString()),
    '__BUILD_TIME__': JSON.stringify(Date.now().toString())
  },
  envPrefix: 'VITE_', // Only expose env vars prefixed with VITE_ to client
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionGeneratorPlugin(),
    buildTimestampPlugin(),
    deferCssPlugin(),
    // Run sitemap generation only in production to avoid noisy logs and CI/tooling issues
    mode === "production" && sitemapPlugin(),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
    }),
    // Only include PWA manifest generation in production. We use a custom sw.js and
    // want to avoid any possible interference during development or testing.
    mode === "production" && VitePWA({
      // Completely disable service worker generation - using custom sw.js instead
      // This prevents Workbox from interfering with chunk loading
      injectRegister: false, // Don't register service worker
      strategies: 'generateSW',
      workbox: {
        // Disable all precaching and runtime caching - custom sw.js handles everything
        globPatterns: [],
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [],
        // Generate empty service worker (will be ignored, custom sw.js takes precedence)
        swDest: 'dist/sw-workbox.js', // Different name so custom sw.js is used
      },
      // Only generate manifest, don't register service worker
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'placeholder.svg'],
      manifest: {
        name: 'Delivery Platform - Wholesale Management',
        short_name: 'Delivery Platform',
        description: 'Comprehensive wholesale and delivery management platform for your business.',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/placeholder.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/placeholder.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        categories: ['business', 'productivity'],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Open dashboard',
            url: '/admin/dashboard',
            icons: [{ src: '/placeholder.svg', sizes: '192x192' }]
          },
          {
            name: 'Orders',
            short_name: 'Orders',
            description: 'View orders',
            url: '/admin/orders',
            icons: [{ src: '/placeholder.svg', sizes: '192x192' }]
          }
        ]
      }
      // Removed workbox config - custom sw.js handles everything
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'], // Force single React instance
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
    esbuildOptions: {
      target: 'es2020',
    },
    entries: ['src/main.tsx'], // Only pre-bundle main entry
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    assetsInlineLimit: 4096,
    cssMinify: true,
    // Reduce memory pressure during builds
    reportCompressedSize: false,
    terserOptions: {
      compress: {
        drop_console: ['log'], // Only drop console.log, keep errors/warnings
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: 'hidden', // Generate hidden source maps for production debugging
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      maxParallelFileOps: 1, // Further limit parallel operations to reduce memory usage
      output: {
        // Add hash to filenames for cache busting  
        entryFileNames: 'assets/entry-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/asset-[hash].[ext]',
        // Ensure React is not split into separate chunks
        manualChunks: (id) => {
          // Exclude React from chunking - keep it in vendor
          if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'vendor';
          }
          // Large deps into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('mapbox') || id.includes('leaflet')) {
              return 'vendor-maps';
            }
            // Split Radix UI components into separate chunk
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // Split chart libraries
            if (id.includes('recharts') || id.includes('@tremor')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}));
