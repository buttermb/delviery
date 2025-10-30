import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface OrderQRCodeProps {
  orderId: string;
  orderNumber: string;
}

export function OrderQRCode({ orderId, orderNumber }: OrderQRCodeProps) {
  const qrValue = JSON.stringify({ orderId, orderNumber });

  const downloadQR = () => {
    const svg = document.getElementById('order-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `order-${orderNumber}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center">
        <h3 className="font-semibold mb-2">Order QR Code</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Show this to your courier
        </p>
      </div>
      
      <div className="flex justify-center bg-white p-4 rounded-lg">
        <QRCodeSVG
          id="order-qr-code"
          value={qrValue}
          size={200}
          level="H"
          includeMargin
        />
      </div>

      <Button onClick={downloadQR} variant="outline" className="w-full">
        <Download className="w-4 h-4 mr-2" />
        Download QR Code
      </Button>
    </Card>
  );
}
