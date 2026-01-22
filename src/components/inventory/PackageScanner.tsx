import { logger } from '@/lib/logger';
/**
 * Mobile Package Scanner Component
 * For runners/couriers to scan packages and manage transfers
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Scan, Package, MapPin, CheckCircle2, XCircle, AlertCircle, Flashlight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseQRCodeData, type QRCodeData, type PackageQRData } from '@/utils/barcodeService';

interface PackageScannerProps {
  onScanSuccess?: (data: PackageQRData) => void;
  onScanError?: (error: string) => void;
  currentTransferId?: string;
  mode?: 'pickup' | 'delivery' | 'general';
}

export function PackageScanner({
  onScanSuccess,
  onScanError,
  currentTransferId,
  mode = 'general'
}: PackageScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState<PackageQRData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to hold the scanner instance so it persists across renders
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize scanner instance once and warm up cameras
  useEffect(() => {
    // Clean up any existing instance
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => { });
        scannerRef.current.clear();
      }
    }

    // Create new instance
    try {
      scannerRef.current = new Html5Qrcode('scanner-container');

      // Warm up camera permissions and cache device list for "Instant-On" feel
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          logger.debug('Scanner warmed up', { devices: devices.length }, { component: 'PackageScanner' });
        }
      }).catch(err => {
        logger.warn('Scanner warmup failed (permissions might be pending)', err, { component: 'PackageScanner' });
      });
    } catch (e) {
      // Element might not exist yet if not rendering the container
    }

    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(err => logger.warn('Scanner stop error', err));
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  const handleScanResult = useCallback(async (decodedText: string) => {
    try {
      const qrData = parseQRCodeData(decodedText);

      if (qrData.type !== 'package') {
        throw new Error('Scanned QR code is not a package');
      }

      const packageData = qrData as PackageQRData;

      // Validate transfer match if in transfer mode
      if (currentTransferId && mode !== 'general') {
        // Check if package is part of current transfer
        // This would need to be validated against the database
      }

      setLastScanned(packageData);
      setError(null);

      // Utilize the stable ref to stop scanning
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
        setTorchOn(false); // Reset torch state
      }

      onScanSuccess?.(packageData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid QR code';
      setError(errorMsg);
      onScanError?.(errorMsg);
    }
  }, [currentTransferId, mode, onScanSuccess, onScanError]);

  const startScanning = async () => {
    // Check if we're on HTTPS (required for camera access)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('Camera access requires HTTPS connection. Please use https:// in the URL.');
      onScanError?.('HTTPS required for camera access');
      return;
    }

    try {
      // Re-initialize if null (should handle cases where component remounted logic is tricky)
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('scanner-container');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors while actively scanning
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err) {
      let errorMsg = 'Failed to start scanner';

      if (err instanceof Error) {
        errorMsg = err.message;

        // Provide user-friendly messages for common errors
        if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
          errorMsg = 'Camera access denied. Please enable camera permissions in your browser settings and try again.';
        } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('NotReadableError')) {
          errorMsg = 'No camera found or camera is in use by another app. Please close other apps using the camera and try again.';
        } else if (errorMsg.includes('NotSupportedError')) {
          errorMsg = 'Camera scanning is not supported on this device or browser. Please use a modern browser like Chrome, Safari, or Firefox.';
        }
      }

      setError(errorMsg);
      setIsScanning(false);
      onScanError?.(errorMsg);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
        setTorchOn(false);
      } catch (err) {
        logger.error('Error stopping scanner:', err);
      }
    }
  };

  const toggleTorch = async () => {
    if (scannerRef.current && isScanning) {
      try {
        const newTorchState = !torchOn;
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: newTorchState }] as any
        });
        setTorchOn(newTorchState);
      } catch (err) {
        logger.warn('Torch toggle failed', err);
        // Fallback user message
        if (err instanceof Error && err.name === 'OverconstrainedError') {
          // Torch not supported
        }
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" aria-hidden="true" />
            Package Scanner
          </CardTitle>
          <CardDescription>
            {mode === 'pickup' && 'Scan packages for pickup'}
            {mode === 'delivery' && 'Scan packages for delivery confirmation'}
            {mode === 'general' && 'Scan package barcodes or QR codes'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scanner Container */}
          <div className="relative">
            <div
              id="scanner-container"
              ref={containerRef}
              className={`w-full aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-muted ${isScanning ? 'border-primary' : 'border-muted-foreground'
                }`}
            >
              {!isScanning && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Scan className="h-12 w-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
                    <p className="text-sm">Camera scanner will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Overlay Flash Button */}
            {isScanning && (
              <div className="absolute bottom-4 right-4 z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                  aria-pressed={torchOn}
                  className={`rounded-full h-12 w-12 shadow-lg ${torchOn ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-black/50 text-white hover:bg-black/70'}`}
                  onClick={toggleTorch}
                >
                  <Flashlight className={`h-6 w-6 ${torchOn ? 'fill-current' : ''}`} aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex-1" size="lg">
                <Scan className="h-4 w-4 mr-2" aria-hidden="true" />
                Start Scanning
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="destructive" className="flex-1" size="lg">
                Stop Scanning
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Scan Error</p>
                  <p className="text-xs text-destructive/80 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Last Scanned Package */}
          {lastScanned && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg">{lastScanned.package_number}</p>
                      <Badge className="bg-green-600 text-white">Scanned</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium">{lastScanned.product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span>{lastScanned.location.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Weight: </span>
                        <span className="font-medium">{lastScanned.weight} {lastScanned.unit}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Batch: </span>
                        <span className="font-medium">{lastScanned.batch.batch_number}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Scan History */}
      {lastScanned && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chain of Custody</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lastScanned.chain_of_custody.map((event, index) => (
                <div key={index} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3 py-1">
                  <div className="flex-1">
                    <p className="font-medium">{event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.location} • {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
