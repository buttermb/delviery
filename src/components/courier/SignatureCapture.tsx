import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PenTool, RotateCcw, CheckCircle } from 'lucide-react';

interface SignatureCaptureProps {
  orderId: string;
  onComplete: (signatureData: string) => void;
  customerName?: string;
}

export function SignatureCapture({ orderId, onComplete, customerName }: SignatureCaptureProps) {
  const sigCanvas = useRef<any>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const clear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const save = () => {
    if (isEmpty || !sigCanvas.current) {
      return;
    }
    
    const signatureData = sigCanvas.current.toDataURL('image/png');
    onComplete(signatureData);
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="w-5 h-5" />
          Customer Signature Required
        </CardTitle>
        {customerName && (
          <p className="text-sm text-muted-foreground">
            Please ask {customerName} to sign below
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-muted rounded-lg overflow-hidden bg-white">
          <SignatureCanvas
            ref={sigCanvas}
            onBegin={handleBegin}
            canvasProps={{
              className: 'w-full h-64 touch-none',
              style: { touchAction: 'none' }
            }}
            backgroundColor="white"
          />
        </div>

        <div className="text-xs text-center text-muted-foreground">
          Sign above using your finger or stylus
        </div>

        <div className="flex gap-3">
          <Button
            onClick={clear}
            variant="outline"
            className="flex-1"
            disabled={isEmpty}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            onClick={save}
            className="flex-1"
            disabled={isEmpty}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete Delivery
          </Button>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            By signing, the customer confirms receipt of order #{orderId.slice(0, 8).toUpperCase()} 
            and age verification (21+).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}