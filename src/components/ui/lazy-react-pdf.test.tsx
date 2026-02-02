/**
 * Tests for lazy-loaded @react-pdf/renderer components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as LazyReactPDF from './lazy-react-pdf';

// Mock @react-pdf/renderer
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-view">{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-text">{children}</div>,
  Image: ({ src }: { src: string }) => <div data-testid="pdf-image" data-src={src} />,
  Link: ({ children, src }: { children: React.ReactNode; src: string }) => (
    <a data-testid="pdf-link" href={src}>{children}</a>
  ),
  PDFDownloadLink: ({ children, document }: { children: React.ReactNode | ((props: any) => React.ReactNode); document: any }) => (
    <div data-testid="pdf-download-link">
      {typeof children === 'function' ? children({ loading: false, url: '', blob: null, error: null }) : children}
    </div>
  ),
  PDFViewer: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-viewer">{children}</div>,
  BlobProvider: ({ children }: { children: (props: any) => React.ReactNode }) => (
    <div data-testid="pdf-blob-provider">
      {children({ loading: false, url: '', blob: null, error: null })}
    </div>
  ),
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

describe('lazy-react-pdf', () => {
  describe('Document component', () => {
    it('should lazy load and render Document component', async () => {
      const { Document } = LazyReactPDF;
      render(
        <Document>
          <div>Test Content</div>
        </Document>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render without errors', async () => {
      const { Document } = LazyReactPDF;
      const { container } = render(
        <Document>
          <div>Test Content</div>
        </Document>
      );

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });

  describe('Page component', () => {
    it('should lazy load and render Page component', async () => {
      const { Page } = LazyReactPDF;
      render(
        <Page size="A4">
          <div>Page Content</div>
        </Page>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
      });
      expect(screen.getByText('Page Content')).toBeInTheDocument();
    });
  });

  describe('View component', () => {
    it('should lazy load and render View component', async () => {
      const { View } = LazyReactPDF;
      render(
        <View>
          <div>View Content</div>
        </View>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-view')).toBeInTheDocument();
      });
      expect(screen.getByText('View Content')).toBeInTheDocument();
    });
  });

  describe('Text component', () => {
    it('should lazy load and render Text component', async () => {
      const { Text } = LazyReactPDF;
      render(<Text>Hello PDF</Text>);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-text')).toBeInTheDocument();
      });
      expect(screen.getByText('Hello PDF')).toBeInTheDocument();
    });
  });

  describe('Image component', () => {
    it('should lazy load and render Image component', async () => {
      const { Image } = LazyReactPDF;
      render(<Image src="/test-image.png" />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-image')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-image')).toHaveAttribute('data-src', '/test-image.png');
    });
  });

  describe('Link component', () => {
    it('should lazy load and render Link component', async () => {
      const { Link } = LazyReactPDF;
      render(<Link src="https://example.com">Click here</Link>);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-link')).toBeInTheDocument();
      });
      expect(screen.getByText('Click here')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-link')).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('PDFDownloadLink component', () => {
    it('should lazy load and render PDFDownloadLink component', async () => {
      const { PDFDownloadLink, Document, Page, Text } = LazyReactPDF;

      render(
        <PDFDownloadLink
          document={
            <Document>
              <Page>
                <Text>Test PDF</Text>
              </Page>
            </Document>
          }
          fileName="test.pdf"
        >
          {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
        </PDFDownloadLink>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-download-link')).toBeInTheDocument();
      });
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });

    it('should support children as ReactNode', async () => {
      const { PDFDownloadLink, Document } = LazyReactPDF;

      render(
        <PDFDownloadLink document={<Document />} fileName="test.pdf">
          <span>Static Download Button</span>
        </PDFDownloadLink>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-download-link')).toBeInTheDocument();
      });
      expect(screen.getByText('Static Download Button')).toBeInTheDocument();
    });
  });

  describe('PDFViewer component', () => {
    it('should lazy load and render PDFViewer component', async () => {
      const { PDFViewer, Document, Page, Text } = LazyReactPDF;

      render(
        <PDFViewer>
          <Document>
            <Page>
              <Text>Viewer Content</Text>
            </Page>
          </Document>
        </PDFViewer>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('BlobProvider component', () => {
    it('should lazy load and render BlobProvider component', async () => {
      const { BlobProvider, Document } = LazyReactPDF;

      render(
        <BlobProvider document={<Document />}>
          {({ loading, url }) => (
            <div>
              {loading ? 'Loading...' : <a href={url || '#'}>Download</a>}
            </div>
          )}
        </BlobProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-blob-provider')).toBeInTheDocument();
      });
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('StyleSheet utility', () => {
    it('should create styles object', () => {
      const styles = LazyReactPDF.StyleSheet.create({
        page: {
          padding: 40,
          fontSize: 12,
        },
        header: {
          marginBottom: 20,
        },
      });

      expect(styles).toEqual({
        page: {
          padding: 40,
          fontSize: 12,
        },
        header: {
          marginBottom: 20,
        },
      });
    });
  });

  describe('Component integration', () => {
    it('should render a complete PDF structure with lazy-loaded components', async () => {
      const { Document, Page, View, Text } = LazyReactPDF;

      render(
        <Document>
          <Page size="A4">
            <View>
              <Text>Invoice #12345</Text>
            </View>
          </Page>
        </Document>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
        expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
        expect(screen.getByTestId('pdf-view')).toBeInTheDocument();
        expect(screen.getByTestId('pdf-text')).toBeInTheDocument();
      });

      expect(screen.getByText('Invoice #12345')).toBeInTheDocument();
    });
  });
});
