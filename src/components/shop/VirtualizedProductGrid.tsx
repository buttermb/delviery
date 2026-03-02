/**
 * Virtualized Product Grid using react-window v2
 * Used when product count exceeds VIRTUALIZATION_THRESHOLD (50)
 * to improve rendering performance for large catalogs.
 */

import { useRef, useState, useEffect } from 'react';
import { Grid } from 'react-window';
import type { CSSProperties } from 'react';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';

export const VIRTUALIZATION_THRESHOLD = 50;

/** Approximate row height: aspect-square image (~width) + card content (~160px) */
const ROW_HEIGHT = 480;
const ROW_HEIGHT_MOBILE = 340;
const GRID_GAP = 16;
const GRID_GAP_MOBILE = 8;
/** Max height of the virtualized scroll container */
const MAX_GRID_HEIGHT = 800;

export interface VirtualizedProductGridProps {
  products: MarketplaceProduct[];
  storeSlug: string;
  accentColor: string;
  onQuickAdd: (e: React.MouseEvent, product: MarketplaceProduct) => void;
  addedProducts: Set<string>;
  onToggleWishlist: (product: MarketplaceProduct) => void;
  isInWishlist: (productId: string) => boolean;
  onQuickView: (productId: string) => void;
}

interface CellData {
  products: MarketplaceProduct[];
  columnCount: number;
  storeSlug: string;
  accentColor: string;
  onQuickAdd: (e: React.MouseEvent, product: MarketplaceProduct) => void;
  addedProducts: Set<string>;
  onToggleWishlist: (product: MarketplaceProduct) => void;
  isInWishlist: (productId: string) => boolean;
  onQuickView: (productId: string) => void;
  gap: number;
}

function ProductCell(props: {
  ariaAttributes: { 'aria-colindex': number; role: 'gridcell' };
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
} & CellData) {
  const {
    columnIndex,
    rowIndex,
    style,
    products,
    columnCount,
    storeSlug,
    accentColor,
    onQuickAdd,
    addedProducts,
    onToggleWishlist,
    isInWishlist,
    onQuickView,
    gap,
  } = props;

  const index = rowIndex * columnCount + columnIndex;
  if (index >= products.length) {
    return <div style={style} />;
  }

  const product = products[index];

  return (
    <div
      style={{
        ...style,
        paddingRight: columnIndex < columnCount - 1 ? gap : 0,
        paddingBottom: gap,
      }}
    >
      <StorefrontProductCard
        product={product}
        storeSlug={storeSlug}
        isPreviewMode={false}
        onQuickAdd={(e) => onQuickAdd(e, product)}
        isAdded={addedProducts.has(product.product_id)}
        onToggleWishlist={() => onToggleWishlist(product)}
        isInWishlist={isInWishlist(product.product_id)}
        onQuickView={() => onQuickView(product.product_id)}
        index={index}
        accentColor={accentColor}
      />
    </div>
  );
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    setWidth(el.clientWidth);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function getResponsiveColumns(width: number): number {
  if (width >= 1024) return 4; // lg: 4 cols
  if (width >= 768) return 3;  // md: 3 cols
  return 2;                     // sm/default: 2 cols
}

export function VirtualizedProductGrid({
  products,
  storeSlug,
  accentColor,
  onQuickAdd,
  addedProducts,
  onToggleWishlist,
  isInWishlist,
  onQuickView,
}: VirtualizedProductGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const columnCount = getResponsiveColumns(containerWidth);
  const isMobile = containerWidth < 640;
  const gap = isMobile ? GRID_GAP_MOBILE : GRID_GAP;
  const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT;
  const rowCount = Math.ceil(products.length / columnCount);

  // Each column gets equal share of the container width
  // We account for gaps by adding them to column width and using padding in cells
  const colWidth = containerWidth > 0
    ? containerWidth / columnCount
    : 0;

  const totalHeight = rowCount * rowHeight;
  const gridHeight = Math.min(totalHeight, MAX_GRID_HEIGHT);

  if (containerWidth === 0) {
    return <div ref={containerRef} className="w-full min-h-[100px]" />;
  }

  return (
    <div ref={containerRef} data-testid="virtualized-product-grid">
      <Grid
        cellComponent={ProductCell}
        cellProps={{
          products,
          columnCount,
          storeSlug,
          accentColor,
          onQuickAdd,
          addedProducts,
          onToggleWishlist,
          isInWishlist,
          onQuickView,
          gap,
        }}
        columnCount={columnCount}
        columnWidth={colWidth}
        rowCount={rowCount}
        rowHeight={rowHeight}
        overscanCount={2}
        style={{ height: `${gridHeight}px`, width: '100%' }}
      />
    </div>
  );
}
