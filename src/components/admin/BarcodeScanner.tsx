import { logger } from '@/lib/logger';
/**
 * Browser-Based Barcode Scanner
 * Uses device camera to scan product barcodes
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Camera, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (barcode: string) => void;
  batchMode?: boolean; // If true, keeps scanner open after each scan
  scannedCount?: number; // Number of items scanned in batch mode
}

export function BarcodeScanner({ open, onOpenChange, onScanSuccess, batchMode = false, scannedCount = 0 }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  // Track scanning state with ref to avoid stale closure in stopScanning
  const isScanningRef = useRef(false);

  const startScanning = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      isScanningRef.current = true;

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10, // Scans per second
          qrbox: { width: 250, height: 250 }, // Scanner box size
        },
        (decodedText) => {
          // Success callback when barcode is detected
          logger.info('Barcode scanned successfully', { barcode: decodedText });
          toast.success(`Barcode detected: ${decodedText}`);
          onScanSuccess(decodedText);

          // Only close if not in batch mode
          if (!batchMode) {
            onOpenChange(false);
          }
        },
        (_errorMessage) => {
          // Error callback (fires continuously, so we don't log it)
        }
      );
    } catch (error) {
      logger.error('Failed to start scanning', error, {
        component: 'BarcodeScanner',
      });
      toast.error('Failed to start camera', { description: humanizeError(error) });
      isScanningRef.current = false;
    }
  }, [onScanSuccess, batchMode, onOpenChange]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        isScanningRef.current = false;
      } catch (error) {
        logger.error('Failed to stop scanning', error, {
          component: 'BarcodeScanner',
        });
      }
    }
  }, []);

  const initializeScanner = useCallback(async () => {
    try {
      setIsInitializing(true);

      // Create scanner instance
      scannerRef.current = new Html5Qrcode('barcode-scanner-region');

      // Start scanning
      await startScanning();
    } catch (error) {
      logger.error('Failed to initialize barcode scanner', error, {
        component: 'BarcodeScanner',
      });
      toast.error('Failed to access camera. Please grant camera permissions.', { description: humanizeError(error) });
    } finally {
      setIsInitializing(false);
    }
  }, [startScanning]);

  useEffect(() => {
    if (open && !scannerRef.current) {
      initializeScanner();
    }

    return () => {
      stopScanning();
    };
  }, [open, initializeScanner, stopScanning]);

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <DialogTitle>Scan Product Barcode</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-11 w-11"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {batchMode 
              ? `Batch scanning mode - ${scannedCount} item${scannedCount !== 1 ? 's' : ''} scanned`
              : 'Position the barcode within the frame to scan'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scanner Region */}
          <div className="relative">
            <div
              id="barcode-scanner-region"
              className="w-full rounded-lg overflow-hidden bg-muted"
              style={{ minHeight: '300px' }}
            />
            
            {isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Initializing camera...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Hold your device steady</p>
            <p>Center the barcode in the frame</p>
            <p>Ensure good lighting for best results</p>
            {batchMode && <p className="text-primary font-medium">Scanner stays open - scan multiple items!</p>}
          </div>
          
          {batchMode && scannedCount > 0 && (
            <div className="flex justify-center">
              <Button onClick={handleClose} variant="default">
                Done Scanning ({scannedCount} items)
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
