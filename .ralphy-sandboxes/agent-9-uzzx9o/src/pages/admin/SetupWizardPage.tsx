/**
 * Setup Wizard Page
 * Full-page onboarding wizard shown after first admin login
 * 5 steps: Business Profile, Products, Delivery Zones, Invite Driver, Preview Storefront
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Package,
  MapPin,
  Truck,
  Eye,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import { useSetupWizard } from '@/hooks/useSetupWizard';
import { SETUP_WIZARD_STEPS, SKIP_WARNINGS } from '@/types/setup-wizard';
import { BusinessProfileStep } from '@/components/onboarding/setup-wizard/BusinessProfileStep';
import { AddProductsStep } from '@/components/onboarding/setup-wizard/AddProductsStep';
import { DeliveryZonesStep } from '@/components/onboarding/setup-wizard/DeliveryZonesStep';
import { InviteDriverStep } from '@/components/onboarding/setup-wizard/InviteDriverStep';
import { PreviewStorefrontStep } from '@/components/onboarding/setup-wizard/PreviewStorefrontStep';

const STEP_ICONS = [Building2, Package, MapPin, Truck, Eye] as const;

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    progressPercent,
    isFirstStep,
    isLastStep,
    isCompleting,
    stepStatuses,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding,
  } = useSetupWizard();

  const handleSkip = () => {
    setShowSkipWarning(true);
  };

  const handleConfirmSkip = async () => {
    setShowSkipWarning(false);
    await skipOnboarding();
    navigate(`/${tenantSlug}/admin/dashboard`);
  };

  const handleComplete = async () => {
    await completeOnboarding();
    navigate(`/${tenantSlug}/admin/dashboard`);
  };

  const handleStepComplete = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      nextStep();
    }
  };

  const skipWarning = SKIP_WARNINGS[currentStep.id];

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">Set Up Your Store</h1>
          <p className="text-muted-foreground">
            Complete these steps to get your store ready for customers
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progressPercent)}% complete
            </span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />

          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {stepStatuses.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex flex-col items-center gap-1.5 transition-all',
                    step.isCurrent && 'scale-110',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                      step.isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : step.isCurrent
                          ? 'bg-primary/15 ring-2 ring-primary'
                          : 'bg-muted',
                    )}
                  >
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          step.isCurrent ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium text-center max-w-[70px] leading-tight hidden sm:block',
                      step.isCurrent
                        ? 'text-primary'
                        : step.isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground',
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardContent className="p-6">
            {currentStep.id === 'business-profile' && (
              <BusinessProfileStep onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'add-products' && (
              <AddProductsStep onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'delivery-zones' && (
              <DeliveryZonesStep onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'invite-driver' && (
              <InviteDriverStep onComplete={handleStepComplete} />
            )}
            {currentStep.id === 'preview-storefront' && (
              <PreviewStorefrontStep onComplete={handleComplete} />
            )}
          </CardContent>
        </Card>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={prevStep} disabled={isCompleting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isCompleting}
              className="text-muted-foreground"
            >
              Skip Setup
            </Button>

            {!isLastStep && (
              <Button variant="outline" onClick={handleStepComplete} disabled={isCompleting}>
                Skip Step
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Skip Warning Dialog */}
      <AlertDialog open={showSkipWarning} onOpenChange={setShowSkipWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {skipWarning?.title || 'Skip Setup?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>If you skip setup now, here's what you'll miss:</p>
                <ul className="space-y-2">
                  {SETUP_WIZARD_STEPS.slice(currentStepIndex).map((step) => {
                    const warning = SKIP_WARNINGS[step.id];
                    return (
                      <li key={step.id} className="text-sm">
                        <span className="font-medium">{step.title}:</span>{' '}
                        {warning.consequences[0]}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm font-medium mt-2">
                  You can complete these steps anytime from Settings.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Setup</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSkip} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Skip & Go to Dashboard'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
