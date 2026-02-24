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

// Lazy load PDF document components - cast to proper types after lazy+Suspense wrapping
export const Document = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Document,
    }))
  )
) as unknown as ComponentType<ReactPDF.DocumentProps>;

export const Page = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Page,
    }))
  )
) as unknown as ComponentType<ReactPDF.PageProps>;

export const View = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.View,
    }))
  )
) as unknown as ComponentType<ReactPDF.ViewProps>;

export const Text = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Text,
    }))
  )
) as unknown as ComponentType<ReactPDF.TextProps>;

export const Image = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Image,
    }))
  )
) as unknown as ComponentType<ReactPDF.ImageProps>;

export const Link = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.Link,
    }))
  )
) as unknown as ComponentType<ReactPDF.LinkProps>;

// Lazy load interactive components
export const PDFDownloadLink = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.PDFDownloadLink,
    }))
  )
) as unknown as ComponentType<ReactPDF.PDFDownloadLinkProps>;

export const PDFViewer = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.PDFViewer,
    }))
  )
) as unknown as ComponentType<ReactPDF.PDFViewerProps>;

export const BlobProvider = withSuspense(
  lazy(() =>
    import('@react-pdf/renderer').then((module) => ({
      default: module.BlobProvider,
    }))
  )
) as unknown as ComponentType<ReactPDF.BlobProviderProps>;

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
  Styles,
} from '@react-pdf/renderer';
