import { useState } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { Button } from '@/components/ui/button';
import X from "lucide-react/dist/esm/icons/x";
import Camera from "lucide-react/dist/esm/icons/camera";
import Flashlight from "lucide-react/dist/esm/icons/flashlight";
import { toast } from 'sonner';

interface BarcodeScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
    open: boolean;
}

export function BarcodeScanner({ onScan, onClose, open }: BarcodeScannerProps) {
    const [torchOn, setTorchOn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur absolute top-0 left-0 right-0 z-10 safe-area-top">
                <span className="text-white font-medium">Scan Barcode</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/20"
                >
                    <X className="w-6 h-6" />
                </Button>
            </div>

            {/* Scanner View */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
                <BarcodeScannerComponent
                    width="100%"
                    height="100%"
                    onUpdate={(err, result) => {
                        if (result) {
                            onScan(result.getText());
                            // Optional: Vibrate on success
                            if (navigator.vibrate) navigator.vibrate(200);
                        }
                        if (err) {
                            // Suppress common errors to avoid log spam
                            // setError(err.message); 
                        }
                    }}
                    torch={torchOn}
                    facingMode="environment"
                />

                {/* Scan Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-primary/50 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary -mt-1 -ml-1" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary -mt-1 -mr-1" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary -mb-1 -ml-1" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary -mb-1 -mr-1" />

                        {/* Scanning Line Animation */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                    </div>
                </div>

                {error && (
                    <div className="absolute bottom-24 left-4 right-4 bg-destructive/80 text-white p-2 rounded text-center text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-8 bg-black/50 backdrop-blur absolute bottom-0 left-0 right-0 safe-area-bottom flex justify-center gap-8">
                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => {
                        // Toggle torch not supported by all browsers/devices via this lib directly sometimes
                        // This is a best-effort implementation
                        setTorchOn(!torchOn);
                    }}
                >
                    <Flashlight className={`w-5 h-5 ${torchOn ? 'text-yellow-400' : ''}`} />
                </Button>
            </div>
        </div>
    );
}
