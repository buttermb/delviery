import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  continuous?: boolean;
}

export function BarcodeScanner({ onScan, continuous = true }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerIdRef = useRef(`reader-${Date.now()}`);

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode(readerIdRef.current);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          onScan(decodedText);
          if (!continuous) {
            stopScanning();
          }
        },
        (_errorMessage) => {
          // Silent - scanning errors are normal
        }
      );

      setIsScanning(true);
    } catch (err) {
      logger.error('Scanner start error:', err);
      toast.error('Could not access camera', { description: humanizeError(err) });
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        logger.error('Scanner stop error:', err);
      }
    }
  };

  const handleManualSubmit = () => {
    if (manualEntry.trim()) {
      onScan(manualEntry.trim());
      setManualEntry('');
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch((err) => logger.error('Failed to stop scanner', err));
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {!showManual && (
        <>
          <div
            id={readerIdRef.current}
            className={`w-full rounded-lg overflow-hidden border ${isScanning ? 'border-primary' : 'border-border'
              }`}
            style={{ minHeight: isScanning ? '300px' : '0' }}
          />

          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="destructive" className="flex-1">
                <CameraOff className="w-4 h-4 mr-2" />
                Stop Camera
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowManual(!showManual);
                if (isScanning) stopScanning();
              }}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Manual
            </Button>
          </div>
        </>
      )}

      {showManual && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Enter barcode manually..."
              aria-label="Enter barcode manually"
              value={manualEntry}
              onChange={(e) => setManualEntry(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleManualSubmit();
              }}
            />
            <Button onClick={handleManualSubmit}>Add</Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManual(false)}
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Use Camera Instead
          </Button>
        </div>
      )}
    </div>
  );
}
