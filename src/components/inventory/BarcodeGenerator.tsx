import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) {
      return;
    }

    // Reset error state
    setError(null);

    try {
      // Validate value for specific formats
      if (format === 'EAN13' && !/^\d{12,13}$/.test(value)) {
        throw new Error('EAN13 requires 12-13 digits');
      }
      if (format === 'UPC' && !/^\d{11,12}$/.test(value)) {
        throw new Error('UPC requires 11-12 digits');
      }

      JsBarcode(canvasRef.current, value, {
        format,
        width,
        height,
        displayValue,
        margin: 10,
        fontSize: 14,
        textMargin: 5,
        valid: (valid) => {
          if (!valid) {
            setError(`Invalid barcode value for ${format} format`);
          }
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate barcode';
      setError(message);
      logger.error('Barcode generation error:', err);
    }
  }, [value, format, width, height, displayValue]);

  if (!value) {
    return (
      <div className="text-sm text-muted-foreground">
        No barcode value provided
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive p-2 bg-destructive/10 rounded">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
}
