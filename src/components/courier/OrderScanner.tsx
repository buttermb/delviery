import BarcodeScanner from 'react-qr-barcode-scanner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface OrderScannerProps {
  onScan: (orderId: string) => void;
  title?: string;
  description?: string;
}

export function OrderScanner({ onScan, title = "Scan Order QR Code", description }: OrderScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState<string | null>(null);

  const handleUpdate = (err: any, result: any) => {
    if (result?.text) {
      const orderId = result.text;
      setScannedId(orderId);
      setScanning(false);
      toast.success('Order scanned successfully!');
      onScan(orderId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {scanning ? (
          <div className="relative">
            <BarcodeScanner
              onUpdate={handleUpdate}
              width="100%"
              height={400}
            />
            
            {/* Scanner overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-primary rounded-lg" />
            </div>
            
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => setScanning(false)}
                variant="outline"
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {scannedId ? (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="font-semibold">Order Scanned</p>
                <p className="text-sm text-muted-foreground">ID: {scannedId}</p>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-muted rounded-lg text-center">
                <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Click below to start scanning
                </p>
              </div>
            )}
            
            <Button
              onClick={() => setScanning(true)}
              className="w-full"
              size="lg"
            >
              <QrCode className="w-4 h-4 mr-2" />
              {scannedId ? 'Scan Another Order' : 'Start Scanning'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}