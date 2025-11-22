import { logger } from '@/lib/logger';
/**
 * Mobile Package Scanner Component
 * For runners/couriers to scan packages and manage transfers
 */

import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Scan, Package, MapPin, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [lastScanned, setLastScanned] = useState<PackageQRData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
  }, [scanner]);

  const startScanning = async () => {
    if (!scannerRef.current) return;

    try {
      const html5QrCode = new Html5Qrcode('scanner-container');
      
      await html5QrCode.start(
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

      setScanner(html5QrCode);
      setIsScanning(true);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start scanner';
      setError(errorMsg);
      setIsScanning(false);
      onScanError?.(errorMsg);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
        setScanner(null);
        setIsScanning(false);
      } catch (err) {
        logger.error('Error stopping scanner:', err);
      }
    }
  };

  const handleScanResult = async (decodedText: string) => {
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
      
      // Stop scanning after successful scan
      await stopScanning();
      
      onScanSuccess?.(packageData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid QR code';
      setError(errorMsg);
      onScanError?.(errorMsg);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
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
          <div
            id="scanner-container"
            ref={scannerRef}
            className={`w-full aspect-square rounded-lg border-2 border-dashed overflow-hidden bg-muted ${
              isScanning ? 'border-primary' : 'border-muted-foreground'
            }`}
          >
            {!isScanning && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Scan className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Camera scanner will appear here</p>
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex-1" size="lg">
                <Scan className="h-4 w-4 mr-2" />
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
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
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
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg">{lastScanned.package_number}</p>
                      <Badge className="bg-green-600 text-white">Scanned</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lastScanned.product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
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

