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
import { cacheHeadersPlugin } from './vite-plugins/cache-headers';

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
    cacheHeadersPlugin(),
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
      registerType: 'prompt', // Change to prompt to avoid blocking render
      injectRegister: 'inline',
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
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB to accommodate large chunks
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
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
    cssCodeSplit: true,
    terserOptions: {
      compress: {
        drop_console: ['log'], // Only drop console.log, keep errors/warnings
        drop_debugger: true,
        passes: 1, // Single pass - two passes breaks chunk references
        // Removed pure_funcs - it breaks React.createElement calls between chunks
      },
      format: {
        comments: false,
      },
      mangle: {
        safari10: true, // Fix Safari 10 issues
        toplevel: false, // Don't mangle top-level names - breaks cross-chunk references
      },
      module: true, // Preserve ES module structure
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
        // Simplified code splitting - fewer chunks = fewer loading order issues
        manualChunks: (id) => {
          // React core - MUST load first
          if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          
          // All other node_modules together
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          
          // Application code - let Vite auto-split by route
        },
      },
      preserveEntrySignatures: 'strict', // Prevent chunk ordering issues
    },
    chunkSizeWarningLimit: 500, // Lower threshold to catch bloat earlier
  },
}));
