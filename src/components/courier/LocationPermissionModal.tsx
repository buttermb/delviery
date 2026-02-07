import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle, Smartphone } from 'lucide-react';
import { useState } from 'react';

interface LocationPermissionModalProps {
  open: boolean;
  onRequestPermission: () => void;
}

export default function LocationPermissionModal({ open, onRequestPermission }: LocationPermissionModalProps) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-md bg-slate-900 border-slate-700 text-white" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white text-xl">
            <MapPin className="h-6 w-6 text-teal-400" />
            Location Required to Deliver Orders
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            We need your location to:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="bg-slate-800 border border-slate-700 p-4 rounded space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">1</span>
              </div>
              <div>
                <div className="font-bold text-white">Show you nearby orders</div>
                <div className="text-sm text-slate-400">See available deliveries in your area</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">2</span>
              </div>
              <div>
                <div className="font-bold text-white">Track your deliveries</div>
                <div className="text-sm text-slate-400">Customers can see when you're arriving</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">3</span>
              </div>
              <div>
                <div className="font-bold text-white">Navigate to pickup & delivery</div>
                <div className="text-sm text-slate-400">Open maps directly from the app</div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded flex items-start space-x-2">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-yellow-500">
              <span className="font-bold">Required:</span> Location must be enabled to receive and complete orders.
            </div>
          </div>

          {!showInstructions ? (
            <>
              <Button 
                onClick={onRequestPermission}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold"
                size="lg"
              >
                <MapPin className="mr-2" size={18} />
                Enable Location Access
              </Button>

              <Button 
                onClick={() => setShowInstructions(true)}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Location Blocked? See Instructions
              </Button>

              <p className="text-xs text-slate-400 text-center">
                Your location is only tracked when you're online and accepting orders.
              </p>
            </>
          ) : (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg space-y-4">
                <div className="font-bold text-yellow-500 flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Location Access Blocked
                </div>
                
                <div className="text-sm text-slate-300 space-y-3">
                  <div>
                    <div className="font-semibold text-white mb-2">📱 iPhone:</div>
                    <ol className="list-decimal list-inside space-y-1 pl-2">
                      <li>Settings → Privacy & Security → Location Services</li>
                      <li>Turn ON Location Services</li>
                      <li>Find "Safari" or this app</li>
                      <li>Select "While Using the App" or "Always"</li>
                    </ol>
                  </div>
                  
                  <div>
                    <div className="font-semibold text-white mb-2">🤖 Android:</div>
                    <ol className="list-decimal list-inside space-y-1 pl-2">
                      <li>Settings → Location (or Security & Location)</li>
                      <li>Turn ON Location</li>
                      <li>Find Chrome or this browser</li>
                      <li>Allow location access</li>
                    </ol>
                  </div>
                </div>
              </div>

              <Button 
                onClick={onRequestPermission}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold"
                size="lg"
              >
                Try Again
              </Button>

              <Button 
                onClick={() => setShowInstructions(false)}
                variant="ghost"
                className="w-full text-slate-400 hover:text-white"
              >
                Back
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
