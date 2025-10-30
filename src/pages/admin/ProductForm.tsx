import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BasicInfoStep } from "@/components/admin/product-form/BasicInfoStep";
import { ImagesStep } from "@/components/admin/product-form/ImagesStep";
import { DetailsStep } from "@/components/admin/product-form/DetailsStep";
import { PricingStep } from "@/components/admin/product-form/PricingStep";
import { ComplianceStep } from "@/components/admin/product-form/ComplianceStep";
import { ReviewStep } from "@/components/admin/product-form/ReviewStep";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  { id: 1, name: "Basic Info", component: BasicInfoStep },
  { id: 2, name: "Images", component: ImagesStep },
  { id: 3, name: "Details", component: DetailsStep },
  { id: 4, name: "Pricing", component: PricingStep },
  { id: 5, name: "Compliance", component: ComplianceStep },
  { id: 6, name: "Review", component: ReviewStep },
];

export default function ProductForm() {
  const { id, action } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Get storage key for this specific form instance
  const storageKey = `product-form-${action || 'new'}-${id || 'draft'}`;
  
  // Initialize form data - ONLY use localStorage for new products (not edits)
  const [formData, setFormData] = useState<any>(() => {
    // Never use localStorage for editing existing products
    if (action === "edit" || action === "duplicate") {
      return {
        name: "",
        category: "",
        strain_type: "",
        thca_percentage: "",
        cbd_content: "",
        description: "",
        price: "",
        prices: {},
        in_stock: true,
        image_url: "",
        images: [],
        coa_url: "",
        effects: [],
        flavors: [],
        terpenes: [],
      };
    }
    
    // Only use localStorage for new products
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved form data:', e);
      }
    }
    return {
      name: "",
      category: "",
      strain_type: "",
      thca_percentage: "",
      cbd_content: "",
      description: "",
      price: "",
      prices: {},
      in_stock: true,
      image_url: "",
      images: [],
      coa_url: "",
      effects: [],
      flavors: [],
      terpenes: [],
    };
  });

  const isEdit = action === "edit";
  const isDuplicate = action === "duplicate";
  const mode = isEdit ? "edit" : isDuplicate ? "duplicate" : "new";

  // Auto-save to localStorage ONLY for new products (not edits)
  useEffect(() => {
    // Don't auto-save to localStorage when editing existing products
    if (mode === "new") {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    }
  }, [formData, storageKey, mode]);

  // Load existing product data (disable refetching to prevent overwriting user changes)
  const { isLoading } = useQuery({
    queryKey: ["product", id],
    enabled: !!id && mode !== "new",
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    queryFn: async () => {
      if (!id || mode === "new") return null;
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) {
        console.error("Error loading product:", error);
        throw error;
      }
      
      if (!data) {
        toast({
          title: "Product not found",
          description: "The product you're trying to edit doesn't exist",
          variant: "destructive",
        });
        navigate("/admin/products");
        return null;
      }
      
      // Parse strain_info if it's a string
      let parsedStrainInfo: any = data.strain_info;
      if (typeof data.strain_info === 'string') {
        try {
          parsedStrainInfo = JSON.parse(data.strain_info);
        } catch (e) {
          parsedStrainInfo = { description: data.strain_info };
        }
      } else if (!parsedStrainInfo) {
        parsedStrainInfo = {};
      }
      
      const loadedData = {
        ...data,
        strain_info: parsedStrainInfo,
        effects: Array.isArray(data.effects) ? data.effects : [],
        images: Array.isArray(data.images) ? data.images : [],
        prices: data.prices || {},
        flavors: [], // Not in DB, keeping for UI state
      };
      
      if (isDuplicate) {
        const duplicateData = { ...loadedData, name: `${loadedData.name} (Copy)`, id: undefined };
        setFormData(duplicateData);
      } else {
        setFormData(loadedData);
      }
      
      // Always clear localStorage for edit/duplicate - database is source of truth
      localStorage.removeItem(storageKey);
      
      return data;
    },
  });

  const saveProduct = useMutation({
    mutationFn: async (data: any) => {
      console.log("=== SAVE PRODUCT START ===");
      console.log("Raw form data:", data);
      
      // Validate and sanitize required fields
      const name = data.name?.trim();
      if (!name) {
        throw new Error("Product name is required");
      }
      
      const category = data.category;
      if (!category) {
        throw new Error("Category is required");
      }
      
      const thca = parseFloat(data.thca_percentage);
      if (isNaN(thca) || thca < 0) {
        throw new Error("Valid cannabinoid percentage is required (0-100)");
      }
      
      const price = parseFloat(data.price);
      if (isNaN(price) || price <= 0) {
        throw new Error("Valid price is required (must be greater than 0)");
      }
      
      // Build sanitized data object with only valid values
      const sanitizedData: any = {
        name: name,
        category: category,
        thca_percentage: thca,
        price: price,
        in_stock: data.in_stock !== undefined ? Boolean(data.in_stock) : true,
        stock_quantity: 0, // Default
      };

      // Optional numeric fields - only add if valid
      if (data.cbd_content) {
        const cbd = parseFloat(data.cbd_content);
        if (!isNaN(cbd)) sanitizedData.cbd_content = cbd;
      }
      
      if (data.weight_grams) {
        const weight = parseFloat(data.weight_grams);
        if (!isNaN(weight)) sanitizedData.weight_grams = weight;
      }
      
      if (data.sale_price) {
        const salePrice = parseFloat(data.sale_price);
        if (!isNaN(salePrice) && salePrice > 0 && salePrice < price) {
          sanitizedData.sale_price = salePrice;
        }
      }
      
      if (data.cost_per_unit) {
        const cost = parseFloat(data.cost_per_unit);
        if (!isNaN(cost) && cost >= 0) sanitizedData.cost_per_unit = cost;
      }
      
      if (data.stock_quantity) {
        const stock = parseInt(data.stock_quantity);
        if (!isNaN(stock) && stock >= 0) sanitizedData.stock_quantity = stock;
      }

      // Optional text fields - only add if not empty
      const validStrainTypes = ['indica', 'sativa', 'hybrid', 'cbd'];
      if (data.strain_type?.trim() && validStrainTypes.includes(data.strain_type.toLowerCase())) {
        sanitizedData.strain_type = data.strain_type.toLowerCase();
      }
      
      const validCategories = ['flower', 'edibles', 'vapes', 'concentrates'];
      if (data.category && !validCategories.includes(data.category)) {
        throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
      
      if (data.description?.trim()) {
        sanitizedData.description = data.description.trim();
      }
      
      if (data.vendor_name?.trim()) {
        sanitizedData.vendor_name = data.vendor_name.trim();
      }
      
      if (data.strain_lineage?.trim()) {
        sanitizedData.strain_lineage = data.strain_lineage.trim();
      }
      
      if (data.image_url?.trim()) {
        sanitizedData.image_url = data.image_url.trim();
      }
      
      if (data.coa_url?.trim()) {
        sanitizedData.coa_url = data.coa_url.trim();
      }
      
      if (data.usage_tips?.trim()) {
        sanitizedData.usage_tips = data.usage_tips.trim();
      }
      
      if (data.lab_name?.trim()) {
        sanitizedData.lab_name = data.lab_name.trim();
      }
      
      if (data.batch_number?.trim()) {
        sanitizedData.batch_number = data.batch_number.trim();
      }
      
      if (data.test_date) {
        sanitizedData.test_date = data.test_date;
      }
      
      // Arrays - only add if non-empty
      if (Array.isArray(data.images) && data.images.length > 0) {
        sanitizedData.images = data.images.filter(img => img && typeof img === 'string');
      }
      
      if (Array.isArray(data.effects) && data.effects.length > 0) {
        sanitizedData.effects = data.effects.filter(e => e && typeof e === 'string');
      }
      
      // JSONB fields - only add if non-empty objects
      if (data.prices && typeof data.prices === 'object') {
        const validPrices: any = {};
        Object.entries(data.prices).forEach(([key, value]) => {
          if (value && !isNaN(parseFloat(value as string))) {
            validPrices[key] = parseFloat(value as string);
          }
        });
        if (Object.keys(validPrices).length > 0) {
          sanitizedData.prices = validPrices;
        }
      }
      
      // Convert strain_info to JSON string if it's an object
      if (data.strain_info) {
        if (typeof data.strain_info === 'object') {
          const strainText = data.strain_info.description || JSON.stringify(data.strain_info);
          if (strainText.trim()) {
            sanitizedData.strain_info = strainText.trim();
          }
        } else if (typeof data.strain_info === 'string' && data.strain_info.trim()) {
          sanitizedData.strain_info = data.strain_info.trim();
        }
      }

      console.log("Sanitized data to save:", sanitizedData);
      console.log("Is Edit:", isEdit, "Product ID:", id);

      // Perform the database operation
      if (isEdit && id) {
        console.log("Updating existing product...");
        const { data: result, error } = await supabase
          .from("products")
          .update(sanitizedData)
          .eq("id", id)
          .select()
          .maybeSingle();
        
        if (error) {
          console.error("Update error:", error);
          throw new Error(error.message || "Failed to update product");
        }
        
        console.log("Update successful:", result);
        return result;
      } else {
        console.log("Creating new product...");
        const { data: result, error } = await supabase
          .from("products")
          .insert([sanitizedData])
          .select()
          .maybeSingle();
        
        if (error) {
          console.error("Insert error:", error);
          throw new Error(error.message || "Failed to create product");
        }
        
        console.log("Insert successful:", result);
        return result;
      }
    },
    onSuccess: async (result) => {
      console.log("=== SAVE SUCCESS ===", result);
      
      // Clear the saved form data after successful save
      localStorage.removeItem(storageKey);
      
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({
        title: isEdit ? "✓ Product updated" : "✓ Product created",
        description: "Changes saved and visible on products page",
      });
      navigate("/admin/products");
    },
    onError: (error: any) => {
      console.error("=== SAVE ERROR ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      
      let errorTitle = "Error saving product";
      let errorMessage = "Please check all fields and try again";
      
      if (error.message) {
        if (error.message.includes("name")) {
          errorTitle = "Product name required";
          errorMessage = "Please enter a product name (3-200 characters)";
        } else if (error.message.includes("category")) {
          errorTitle = "Category required";
          errorMessage = "Please select a product category";
        } else if (error.message.includes("THCA") || error.message.includes("cannabinoid")) {
          errorTitle = "Cannabinoid percentage required";
          errorMessage = "Please enter a valid cannabinoid percentage (0-100)";
        } else if (error.message.includes("price")) {
          errorTitle = "Price required";
          errorMessage = "Please enter a valid price greater than $0";
        } else if (error.code === "23502") {
          errorTitle = "Missing required field";
          errorMessage = "Please fill in all required fields: Name, Category, Cannabinoid %, and Price";
        } else if (error.code === "23514") {
          errorTitle = "Invalid data";
          errorMessage = "One or more fields contain invalid values. Please check numeric fields.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = () => {
    // Validate at least name is present for draft
    if (!formData.name) {
      toast({
        title: "Product name required",
        description: "Please enter a product name before saving",
        variant: "destructive",
      });
      return;
    }
    
    saveProduct.mutate({ ...formData, in_stock: false });
  };

  const handlePublish = () => {
    // Validate required fields
    if (!formData.name?.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter a product name",
        variant: "destructive",
      });
      setCurrentStep(1);
      return;
    }
    
    if (!formData.category) {
      toast({
        title: "Category required",
        description: "Please select a product category",
        variant: "destructive",
      });
      setCurrentStep(1);
      return;
    }
    
    if (!formData.thca_percentage || parseFloat(formData.thca_percentage) === 0) {
      toast({
        title: "Cannabinoid percentage required",
        description: "Please enter the cannabinoid percentage",
        variant: "destructive",
      });
      setCurrentStep(1);
      return;
    }
    
    if (!formData.price || parseFloat(formData.price) === 0) {
      toast({
        title: "Price required",
        description: "Please enter a product price",
        variant: "destructive",
      });
      setCurrentStep(4);
      return;
    }
    
    saveProduct.mutate({ ...formData, in_stock: true });
  };

  const updateFormData = (updates: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev, ...updates };
      return newData;
    });
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;
  const progress = (currentStep / STEPS.length) * 100;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/products")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEdit ? "Edit Product" : isDuplicate ? "Duplicate Product" : "Add New Product"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSaveDraft} 
          variant="outline"
          disabled={saveProduct.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveProduct.isPending ? "Saving..." : "Save Draft"}
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`hover:text-foreground ${
                currentStep === step.id ? "font-semibold text-foreground" : ""
              }`}
            >
              {step.name}
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <Card className="p-6">
        <CurrentStepComponent
          formData={formData}
          updateFormData={updateFormData}
        />
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          onClick={handleBack}
          variant="outline"
          disabled={currentStep === 1 || saveProduct.isPending}
        >
          ← Back
        </Button>
        <div className="flex gap-2">
          {currentStep === STEPS.length ? (
            <>
              <Button 
                onClick={handleSaveDraft} 
                variant="outline"
                disabled={saveProduct.isPending}
              >
                {saveProduct.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button 
                onClick={handlePublish}
                disabled={saveProduct.isPending}
              >
                {saveProduct.isPending ? "Publishing..." : "Publish Product"}
              </Button>
            </>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={saveProduct.isPending}
            >
              Next: {STEPS[currentStep]?.name} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
