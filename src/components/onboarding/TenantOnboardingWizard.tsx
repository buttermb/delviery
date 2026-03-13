import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Building2, Package, MapPin, Store } from 'lucide-react';

import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { logger } from '@/lib/logger';

const ONBOARDING_STEPS = [
  {
    id: 'business-setup',
    title: 'Business Setup',
    description: 'Configure your business details',
    icon: Building2,
    path: '/admin/settings/general',
  },
  {
    id: 'add-products',
    title: 'Add Products',
    description: 'Create your first products',
    icon: Package,
    path: '/admin/products/new',
  },
  {
    id: 'delivery-zones',
    title: 'Set Delivery Zones',
    description: 'Define where you deliver',
    icon: MapPin,
    path: '/admin/settings/delivery-zones',
  },
  {
    id: 'preview-storefront',
    title: 'Preview Storefront',
    description: 'See how your store looks to customers',
    icon: Store,
    path: '/admin/storefront/preview',
  },
];

interface TenantOnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function TenantOnboardingWizard({ onComplete, onSkip }: TenantOnboardingWizardProps) {
  const { tenantSlug } = useTenantContext();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const progressPercent = (completedSteps.length / ONBOARDING_STEPS.length) * 100;

  const handleStepClick = (stepId: string, path: string) => {
    logger.info('[OnboardingWizard] Step clicked', { stepId, path });

    if (tenantSlug) {
      navigate(`/${tenantSlug}${path}`);
    }
  };

  const handleStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      const newCompleted = [...completedSteps, stepId];
      setCompletedSteps(newCompleted);

      logger.info('[OnboardingWizard] Step completed', { stepId, totalCompleted: newCompleted.length });

      // Move to next step
      if (currentStep < ONBOARDING_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // All steps completed
        onComplete?.();
      }
    }
  };

  const handleSkip = () => {
    logger.info('[OnboardingWizard] Onboarding skipped');
    onSkip?.();
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to FloraIQ</CardTitle>
          <CardDescription>
            Let&apos;s get your dispensary set up in just a few steps
          </CardDescription>
          <Progress value={progressPercent} className="mt-4" />
          <p className="text-sm text-gray-600 mt-2">
            {completedSteps.length} of {ONBOARDING_STEPS.length} steps completed
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ONBOARDING_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = index === currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 border rounded-lg transition-all ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-50'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {!isCompleted && (
                    <Button
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStepClick(step.id, step.path)}
                      className="gap-2"
                    >
                      {isCurrent ? 'Start' : 'Begin'}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                  {isCompleted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepClick(step.id, step.path)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            {completedSteps.length === ONBOARDING_STEPS.length && (
              <Button onClick={onComplete}>Complete Setup</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
