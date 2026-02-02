import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import type * as ReactPDF from '@react-pdf/renderer';

// Skeleton loader for PDF components
const PDFSkeleton = () => (
  <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded">
    <div className="text-sm text-muted-foreground">Loading PDF...</div>
  </div>
);

// Higher-order component to wrap lazy components with Suspense
function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback: ReactNode = <PDFSkeleton />
) {
  return (props: P) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

// Lazy load PDF document components
export const Document = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Document,
    }))
  )
) as typeof ReactPDF.Document;

export const Page = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Page,
    }))
  )
) as typeof ReactPDF.Page;

export const View = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.View,
    }))
  )
) as typeof ReactPDF.View;

export const Text = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Text,
    }))
  )
) as typeof ReactPDF.Text;

export const Image = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Image,
    }))
  )
) as typeof ReactPDF.Image;

export const Link = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Link,
    }))
  )
) as typeof ReactPDF.Link;

// Lazy load interactive components
export const PDFDownloadLink = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.PDFDownloadLink,
    }))
  )
) as typeof ReactPDF.PDFDownloadLink;

export const PDFViewer = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.PDFViewer,
    }))
  )
) as typeof ReactPDF.PDFViewer;

export const BlobProvider = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.BlobProvider,
    }))
  )
) as typeof ReactPDF.BlobProvider;

// Lazy load style utilities - these don't need Suspense as they're utilities
export const StyleSheet = {
  create: <T extends ReactPDF.Styles>(styles: T): T => {
    // Return styles as-is initially, will be processed when PDF library loads
    return styles;
  },
};

// Re-export types for convenience
export type {
  DocumentProps,
  PageProps,
  ViewProps,
  TextProps,
  ImageProps,
  LinkProps,
  PDFDownloadLinkProps,
  PDFViewerProps,
  BlobProviderProps,
  Style,
  Styles,
} from '@react-pdf/renderer';
