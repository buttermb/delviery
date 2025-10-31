import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Keyboard, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AgeVerificationScannerProps {
  open: boolean;
  onClose: () => void;
  onVerified: (isOver21: boolean, ageData: any) => void;
}

export default function AgeVerificationScanner({ open, onClose, onVerified }: AgeVerificationScannerProps) {
  const [mode, setMode] = useState<'select' | 'scan' | 'manual'>('select');
  const [dob, setDob] = useState('');
  const [verificationResult, setVerificationResult] = useState<{ isOver21: boolean; age: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleManualVerify = () => {
    if (!dob) {
      toast.error('Please enter date of birth');
      return;
    }

    const age = calculateAge(dob);
    const isOver21 = age >= 21;
    
    setVerificationResult({ isOver21, age });
  };

  const handleScanStart = async () => {
    setMode('scan');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      toast.info('Align the barcode on the back of the ID with the frame');
      
      // Placeholder for actual barcode scanning
      // In production, integrate with @zxing/library for PDF417 barcode scanning
      setTimeout(() => {
        toast.info('Barcode scanning will be implemented with production license scanner library');
        setMode('select');
      }, 3000);
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Unable to access camera. Please use manual entry.');
      setMode('manual');
    }
  };

  const handleComplete = () => {
    if (verificationResult) {
      onVerified(verificationResult.isOver21, {
        age: verificationResult.age,
        dob,
        verificationMethod: mode === 'scan' ? 'barcode' : 'manual',
        verifiedAt: new Date().toISOString()
      });
    }
  };

  const resetForm = () => {
    setMode('select');
    setDob('');
    setVerificationResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-yellow-500" />
            Verify Age (21+)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'select' && !verificationResult && (
            <div className="space-y-3">
              <Button
                onClick={handleScanStart}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white h-20 text-lg"
              >
                <Camera className="mr-2 h-6 w-6" />
                Scan ID Barcode
              </Button>
              
              <Button
                onClick={() => setMode('manual')}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 h-16"
              >
                <Keyboard className="mr-2 h-5 w-5" />
                Enter Manually
              </Button>

              <p className="text-xs text-slate-400 text-center">
                Scan the barcode on the back of a valid government-issued ID
              </p>
            </div>
          )}

          {mode === 'scan' && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden h-64">
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-teal-500/50 m-8"></div>
              </div>
              
              <p className="text-sm text-center text-slate-300">
                Align the barcode within the frame
              </p>
              
              <Button
                onClick={() => {
                  setMode('select');
                  if (videoRef.current?.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                  }
                }}
                variant="outline"
                className="w-full border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
            </div>
          )}

          {mode === 'manual' && !verificationResult && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dob" className="text-slate-200">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <Button
                onClick={handleManualVerify}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                disabled={!dob}
              >
                Calculate Age
              </Button>

              <Button
                onClick={resetForm}
                variant="outline"
                className="w-full border-slate-600 text-slate-300"
              >
                Back
              </Button>
            </div>
          )}

          {verificationResult && (
            <div className="space-y-4">
              <div className={`p-6 rounded-lg border-2 ${
                verificationResult.isOver21 
                  ? 'bg-green-500/10 border-green-500' 
                  : 'bg-red-500/10 border-red-500'
              }`}>
                <div className="flex items-center justify-center gap-3 mb-4">
                  {verificationResult.isOver21 ? (
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  ) : (
                    <XCircle className="h-12 w-12 text-red-500" />
                  )}
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-2 ${
                    verificationResult.isOver21 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {verificationResult.isOver21 ? '✓ Customer is 21+' : '✗ Customer is UNDER 21'}
                  </div>
                  <div className="text-lg text-slate-300">
                    Customer age: {verificationResult.age} years old
                  </div>
                </div>
              </div>

              {verificationResult.isOver21 ? (
                <>
                  <div className="bg-slate-800 border border-slate-700 p-4 rounded space-y-2">
                    <div className="font-semibold text-white">Next Steps:</div>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>1. Take photo of ID (front only)</div>
                      <div>2. Customer signature</div>
                      <div>3. Complete delivery</div>
                    </div>
                  </div>

                  <Button
                    onClick={handleComplete}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold h-12"
                  >
                    Continue to ID Photo
                  </Button>
                </>
              ) : (
                <>
                  <div className="bg-red-500/10 border border-red-500/30 p-4 rounded space-y-2">
                    <div className="font-semibold text-red-500">Cannot Complete Delivery</div>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>☑ Return products to store</div>
                      <div>☑ Report incident</div>
                      <div>☑ Customer will be charged cancellation fee</div>
                    </div>
                  </div>

                  <Button
                    onClick={handleComplete}
                    variant="destructive"
                    className="w-full font-bold h-12"
                  >
                    Confirm & Return to Store
                  </Button>
                </>
              )}

              <Button
                onClick={resetForm}
                variant="ghost"
                className="w-full text-slate-400"
              >
                Verify Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
