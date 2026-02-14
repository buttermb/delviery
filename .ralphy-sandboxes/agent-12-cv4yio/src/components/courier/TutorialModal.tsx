import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, MapPin, DollarSign, CheckCircle, Navigation, AlertCircle, Download } from 'lucide-react';

interface TutorialModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function TutorialModal({ open, onComplete }: TutorialModalProps) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      icon: Package,
      title: 'Welcome to NYM Courier!',
      description: 'Let\'s walk through how to use the app and start earning today.',
      color: 'text-teal-400'
    },
    {
      icon: Download,
      title: 'Install as App (Recommended)',
      description: 'For the best experience, add this to your home screen. On iPhone: Tap Share → "Add to Home Screen". On Android: Tap menu (⋮) → "Install app" or "Add to Home screen". This makes it work like a native app!',
      color: 'text-purple-400'
    },
    {
      icon: MapPin,
      title: 'Enable Location',
      description: 'We need your location to track deliveries and show you nearby orders. This is required for the app to work.',
      color: 'text-blue-400'
    },
    {
      icon: Package,
      title: 'Accept Orders',
      description: 'Browse available orders in the "Available" tab. Tap "Accept Order" to start a delivery. Orders show the payout, distance, and item count.',
      color: 'text-teal-400'
    },
    {
      icon: Navigation,
      title: 'Follow the Steps',
      description: 'After accepting, follow the 4-step flow: 1) Navigate to Store → 2) Pick Up → 3) Navigate to Customer → 4) Verify ID (21+) → Complete.',
      color: 'text-yellow-400'
    },
    {
      icon: AlertCircle,
      title: 'ID Verification Required',
      description: 'CRITICAL: You MUST verify the customer is 21+ before handing over products. This is required by NYC law. Check their valid ID.',
      color: 'text-red-400'
    },
    {
      icon: DollarSign,
      title: 'Track Earnings',
      description: 'View your earnings in the "Earnings" tab. You earn a commission on each delivery plus tips. Cash out anytime!',
      color: 'text-green-400'
    },
    {
      icon: CheckCircle,
      title: 'You\'re Ready!',
      description: 'Toggle "Online" in the top right to start receiving orders. Good luck and stay safe!',
      color: 'text-teal-400'
    }
  ];

  const currentStep = steps[step - 1];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-700" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Courier App Tutorial - Step {step}</DialogTitle>
        <DialogDescription className="sr-only">{currentStep.description}</DialogDescription>
        <div className="p-6 text-center">
          <div className={`mx-auto mb-4 w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center ${currentStep.color}`}>
            <Icon size={32} />
          </div>
          
          <h2 className="text-2xl font-black text-white mb-3">{currentStep.title}</h2>
          <p className="text-slate-300 mb-6">{currentStep.description}</p>

          <div className="flex items-center justify-center space-x-2 mb-6">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all ${
                  idx + 1 === step ? 'w-8 bg-teal-500' : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex space-x-3">
            {step > 1 && (
              <Button
                onClick={() => setStep(step - 1)}
                variant="outline"
                className="flex-1 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => {
                if (step === steps.length) {
                  onComplete();
                } else {
                  setStep(step + 1);
                }
              }}
              className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold"
            >
              {step === steps.length ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
