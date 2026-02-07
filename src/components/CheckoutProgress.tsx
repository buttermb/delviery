import { CheckCircle2 } from "lucide-react";

interface CheckoutProgressProps {
  currentStep: 1 | 2 | 3;
}

const CheckoutProgress = ({ currentStep }: CheckoutProgressProps) => {
  const steps = [
    { number: 1, label: "Cart Review" },
    { number: 2, label: "Delivery Info" },
    { number: 3, label: "Payment" }
  ];

  return (
    <div className="w-full py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-muted -z-10">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />
          </div>

          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center gap-2 bg-background px-4">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  transition-all duration-300
                  ${
                    currentStep > step.number
                      ? "bg-primary text-white"
                      : currentStep === step.number
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {currentStep > step.number ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`
                  text-xs font-medium
                  ${
                    currentStep >= step.number
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                `}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckoutProgress;
