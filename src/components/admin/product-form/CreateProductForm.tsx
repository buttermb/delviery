import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
// Card components available for future use if needed
import { Progress } from "@/components/ui/progress";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Check from "lucide-react/dist/esm/icons/check";
import Package from "lucide-react/dist/esm/icons/package";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check";
import { toast } from "sonner";
import { humanizeError } from "@/lib/humanizeError";
import { sanitizeFormInput, sanitizeTextareaInput, sanitizeSkuInput } from "@/lib/utils/sanitize";
import { BasicInfoStep } from "./BasicInfoStep";
import { PricingStep } from "./PricingStep";
import { DetailsStep } from "./DetailsStep";
import { ComplianceStep } from "./ComplianceStep";
import { ImagesStep } from "./ImagesStep";
import { ReviewStep } from "./ReviewStep";
import { VariantsStep } from "./VariantsStep";
// JSON type available from @/integrations/supabase/types if needed

// Comprehensive form data interface covering all product fields
export interface CreateProductFormData {
  // Basic Info
  name: string;
  category: string;
  strain_name: string;
  strain_lineage: string;
  strain_type: string;
  vendor_name: string;
  thca_percentage: number | string;
  cbd_content: number | string;
  weight_grams: number | string;

  // Pricing & Inventory
  price: number | string;
  sale_price: number | string;
  cost_per_unit: number | string;
  wholesale_price: number | string;
  retail_price: number | string;
  stock_quantity: number | string;
  available_quantity: number | string;
  in_stock: boolean;
  low_stock_alert: number | string;

  // Price Variants (weight-based pricing)
  prices: Record<string, number | string>;

  // Details
  description: string;
  strain_info: { description?: string } | null;
  effects: string[];
  flavors: string[];
  terpenes: Record<string, number | string>;
  usage_tips: string;
  medical_benefits: string[];
  consumption_methods: string[];

  // Compliance
  coa_url: string;
  coa_filename: string;
  lab_name: string;
  test_date: string;
  batch_number: string;

  // Images
  image_url: string;
  images: string[];

  // Inventory/Tracking
  sku: string;
  barcode: string;

  // Visibility
  menu_visibility: boolean;
  publish_status: "publish" | "draft";

  // Allow additional fields
  [key: string]: unknown;
}

interface CreateProductFormProps {
  initialData?: Partial<CreateProductFormData>;
  onSubmit: (data: CreateProductFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEditMode?: boolean;
  /** Store settings for potency validation (reserved for future use) */
  storeSettings?: {
    potency_limit_thc?: number;
    potency_limit_cbd?: number;
  } | null;
}

const STEPS = [
  { id: "basic", label: "Basic Info", icon: Package },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "variants", label: "Variants", icon: Package },
  { id: "details", label: "Details", icon: FileText },
  { id: "compliance", label: "Compliance", icon: Shield },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

type StepId = typeof STEPS[number]["id"];

const DEFAULT_FORM_DATA: CreateProductFormData = {
  // Basic Info
  name: "",
  category: "",
  strain_name: "",
  strain_lineage: "",
  strain_type: "",
  vendor_name: "",
  thca_percentage: "",
  cbd_content: "",
  weight_grams: "",

  // Pricing & Inventory
  price: "",
  sale_price: "",
  cost_per_unit: "",
  wholesale_price: "",
  retail_price: "",
  stock_quantity: "",
  available_quantity: "",
  in_stock: true,
  low_stock_alert: "10",

  // Price Variants
  prices: {},

  // Details
  description: "",
  strain_info: null,
  effects: [],
  flavors: [],
  terpenes: {},
  usage_tips: "",
  medical_benefits: [],
  consumption_methods: [],

  // Compliance
  coa_url: "",
  coa_filename: "",
  lab_name: "",
  test_date: "",
  batch_number: "",

  // Images
  image_url: "",
  images: [],

  // Inventory/Tracking
  sku: "",
  barcode: "",

  // Visibility
  menu_visibility: true,
  publish_status: "publish",
};

export function CreateProductForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditMode = false,
  // storeSettings can be used for potency validation in future iterations
}: CreateProductFormProps) {
  const [currentStep, setCurrentStep] = useState<StepId>("basic");
  const [formData, setFormData] = useState<CreateProductFormData>(() => ({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStepErrors, setShowStepErrors] = useState<Record<string, boolean>>({});

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const updateFormData = useCallback((updates: Partial<CreateProductFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const validateStep = (stepId: StepId): boolean => {
    let valid = true;
    switch (stepId) {
      case "basic":
        if (!formData.name?.trim() || !formData.category) {
          valid = false;
        }
        break;

      case "pricing": {
        const price = typeof formData.price === 'string' ? parseFloat(formData.price) : formData.price;
        if (!price || price <= 0) {
          valid = false;
        }
        // Block negative values on all price fields
        const priceFields = [formData.sale_price, formData.cost_per_unit, formData.wholesale_price, formData.retail_price];
        for (const pf of priceFields) {
          if (pf !== "" && pf !== undefined && pf !== null) {
            const num = typeof pf === 'string' ? parseFloat(pf) : (pf as number);
            if (!isNaN(num) && num < 0) {
              valid = false;
            }
          }
        }
        const stock = formData.stock_quantity;
        if (stock !== "" && stock !== undefined && stock !== null) {
          const stockNum = typeof stock === 'string' ? parseFloat(stock as string) : (stock as number);
          if (!Number.isInteger(stockNum) || stockNum < 0) {
            valid = false;
          }
        }
        // Block negative values on available_quantity and low_stock_alert
        const quantityFields = [formData.available_quantity, formData.low_stock_alert];
        for (const qf of quantityFields) {
          if (qf !== "" && qf !== undefined && qf !== null) {
            const num = typeof qf === 'string' ? parseFloat(qf as string) : (qf as number);
            if (!isNaN(num) && num < 0) {
              valid = false;
            }
          }
        }
        break;
      }

      case "variants":
      case "details":
      case "compliance":
      case "images":
      case "review":
        break;

      default:
        break;
    }

    if (!valid) {
      setShowStepErrors((prev) => ({ ...prev, [stepId]: true }));
      toast.error("Please fix the highlighted errors before continuing");
    } else {
      setShowStepErrors((prev) => ({ ...prev, [stepId]: false }));
    }
    return valid;
  };

  const goToStep = (stepId: StepId) => {
    const targetIndex = STEPS.findIndex((s) => s.id === stepId);
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

    // Can always go back
    if (targetIndex < currentIndex) {
      setCurrentStep(stepId);
      return;
    }

    // Validate current step before going forward
    if (targetIndex > currentIndex) {
      // Validate all steps between current and target
      for (let i = currentIndex; i < targetIndex; i++) {
        if (!validateStep(STEPS[i].id)) {
          setCurrentStep(STEPS[i].id);
          return;
        }
      }
    }

    setCurrentStep(stepId);
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const sanitizeFormData = (data: CreateProductFormData): CreateProductFormData => {
    return {
      ...data,
      name: sanitizeFormInput(data.name, 200),
      sku: data.sku ? sanitizeSkuInput(data.sku) : "",
      vendor_name: sanitizeFormInput(data.vendor_name, 100),
      strain_name: sanitizeFormInput(data.strain_name, 100),
      strain_lineage: sanitizeFormInput(data.strain_lineage, 200),
      batch_number: sanitizeFormInput(data.batch_number, 100),
      lab_name: sanitizeFormInput(data.lab_name, 100),
      description: sanitizeTextareaInput(data.description, 2000),
      usage_tips: sanitizeTextareaInput(data.usage_tips, 500),
      barcode: sanitizeFormInput(data.barcode, 50),
    };
  };

  const handleSubmit = async () => {
    // Final validation
    const requiredFields = [
      { field: "name", label: "Product name" },
      { field: "category", label: "Category" },
      { field: "price", label: "Price" },
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field]) {
        toast.error(`${label} is required`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const sanitizedData = sanitizeFormData(formData);
      await onSubmit(sanitizedData);
    } catch (error) {
      toast.error(humanizeError(error, "Failed to save product"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "basic":
        return (
          <BasicInfoStep
            formData={formData}
            updateFormData={updateFormData}
            showErrors={!!showStepErrors.basic}
          />
        );

      case "pricing":
        return (
          <PricingStep
            formData={formData}
            updateFormData={updateFormData}
            showErrors={!!showStepErrors.pricing}
          />
        );

      case "variants":
        return (
          <VariantsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );

      case "details":
        return (
          <DetailsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );

      case "compliance":
        return (
          <ComplianceStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );

      case "images":
        return (
          <ImagesStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );

      case "review":
        return (
          <ReviewStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );

      default:
        return null;
    }
  };

  const loading = isLoading || isSubmitting;

  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="border-b pb-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {isEditMode ? "Edit Product" : "Create New Product"}
          </h2>
          <span className="text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />

        {/* Step Indicators */}
        <div className="flex justify-between mt-4 overflow-x-auto">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                disabled={loading}
                className={`
                  flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors min-w-[70px]
                  ${isActive ? "bg-primary/10 text-primary" : ""}
                  ${isCompleted ? "text-green-600" : "text-muted-foreground"}
                  hover:bg-muted/50 disabled:opacity-50
                `}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2
                  ${isActive ? "border-primary bg-primary text-primary-foreground" : ""}
                  ${isCompleted ? "border-green-600 bg-green-600 text-white" : "border-muted-foreground/30"}
                `}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs font-medium whitespace-nowrap">
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-1">
        {renderStepContent()}
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-4 border-t mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={currentStepIndex === 0 ? onCancel : handleBack}
          disabled={loading}
        >
          {currentStepIndex === 0 ? (
            "Cancel"
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </>
          )}
        </Button>

        {currentStep === "review" ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {isEditMode ? "Update Product" : "Create Product"}
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={loading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
