import { logger } from '@/lib/logger';
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeGenerator({
  value,
  format = 'CODE128',
  width = 2,
  height = 50,
  displayValue = true,
  className = ''
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format,
          width,
          height,
          displayValue,
          margin: 10,
          fontSize: 14,
          textMargin: 5
        });
      } catch (error) {
        logger.error('Barcode generation error:', error);
      }
    }
  }, [value, format, width, height, displayValue]);

  if (!value) {
    return (
      <div className="text-sm text-muted-foreground">
        No barcode value provided
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
}
