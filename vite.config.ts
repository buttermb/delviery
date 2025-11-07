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
import { deferCssPlugin } from "./vite-plugins/defer-css";
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { buildTimestampPlugin } from './vite-plugins/build-timestamp';
import { realtimeValidationPlugin } from './vite-plugins/realtime-validation';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'BUILD_TIMESTAMP': JSON.stringify(Date.now().toString())
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    buildTimestampPlugin(),
    deferCssPlugin(),
    realtimeValidationPlugin(),
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
    VitePWA({
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
}));
