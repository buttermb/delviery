import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeFormInput, sanitizeTextareaInput, sanitizeSkuInput } from "@/lib/utils/sanitize";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Package from "lucide-react/dist/esm/icons/package";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Image as ImageIcon from "lucide-react/dist/esm/icons/image as image-icon";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Barcode from "lucide-react/dist/esm/icons/barcode";
import Layers from "lucide-react/dist/esm/icons/layers";
import Scale from "lucide-react/dist/esm/icons/scale";
import { toast } from "sonner";
import { ProductVariantsManager } from "@/components/admin/products/ProductVariantsManager";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCategories, type Category } from "@/hooks/useCategories";
import { ProductCategorySelect } from "@/components/admin/products/ProductCategorySelect";

// Type for variant data passed to ProductVariantsManager
interface ProductVariantsData {
    prices: Record<string, number>;
    weight_grams: number | null;
    strain_name?: string;
    strain_type?: string;
    strain_lineage?: string;
    thc_percent: number | null;
    cbd_percent: number | null;
    terpenes: Record<string, number>;
}

// Define the shape of form data
export interface ProductFormData {
    name: string;
    sku: string;
    category: string;
    category_id?: string; // Optional hierarchical category reference
    vendor_name: string;
    strain_name: string;
    strain_type: string;
    strain_lineage: string;
    thc_percent: string;
    cbd_percent: string;
    batch_number: string;
    cost_per_unit: string;
    wholesale_price: string;
    retail_price: string;
    available_quantity: string;
    description: string;
    image_url: string;
    low_stock_alert: string;
    metrc_retail_id: string;
    exclude_from_discounts: boolean;
    minimum_price: string;
    // Variant fields
    prices: Record<string, number>;
    weight_grams: string;
    terpenes: Record<string, number>;
}

interface ProductFormProps {
    initialData?: Partial<ProductFormData>;
    onSubmit: (data: ProductFormData, imageFile: File | null) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
    isEditMode: boolean;
    storeSettings?: Record<string, unknown>; // Pass in settings for potency limits
    productId?: string; // Required for variants tab when editing
}

const DEFAULT_FORM_DATA: ProductFormData = {
    name: "",
    sku: "",
    category: "",
    category_id: undefined,
    vendor_name: "",
    strain_name: "",
    strain_type: "",
    strain_lineage: "",
    thc_percent: "",
    cbd_percent: "",
    batch_number: "",
    cost_per_unit: "",
    wholesale_price: "",
    retail_price: "",
    available_quantity: "",
    description: "",
    image_url: "",
    low_stock_alert: "10",
    metrc_retail_id: "",
    exclude_from_discounts: false,
    minimum_price: "",
    // Variant defaults
    prices: {},
    weight_grams: "",
    terpenes: {},
};

export function ProductForm({
    initialData,
    onSubmit,
    onCancel,
    isLoading,
    isEditMode,
    storeSettings,
    productId,
}: ProductFormProps) {
    const { tenant } = useTenantAdminAuth();
    const { data: categories = [] } = useCategories();
    const hasHierarchicalCategories = categories.length > 0;
    const getCategoryById = (id: string) => categories.find((c: Category) => c.id === id);

    const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM_DATA);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("details");

    const checkPotencyLimit = (field: 'thc_percent' | 'cbd_percent', value: string) => {
        const numVal = parseFloat(value);
        if (!storeSettings || isNaN(numVal)) return;

        const limit = field === 'thc_percent' 
          ? (storeSettings.potency_limit_thc as number | undefined) 
          : (storeSettings.potency_limit_cbd as number | undefined);

        if (limit && numVal > limit) {
            toast.warning(`Potency Alert: Value exceeds store limit of ${limit}%`);
        }
    };

    useEffect(() => {
        if (initialData) {
            setFormData({ ...DEFAULT_FORM_DATA, ...initialData });
            if (initialData.image_url) {
                setImagePreview(initialData.image_url);
            }
        }
    }, [initialData]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Invalid file type');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large (max 5MB)');
            return;
        }

        setImageFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sanitizedData: ProductFormData = {
            ...formData,
            name: sanitizeFormInput(formData.name, 100),
            sku: formData.sku ? sanitizeSkuInput(formData.sku) : '',
            vendor_name: sanitizeFormInput(formData.vendor_name, 100),
            strain_name: sanitizeFormInput(formData.strain_name, 100),
            batch_number: sanitizeFormInput(formData.batch_number, 100),
            description: sanitizeTextareaInput(formData.description, 1000),
            metrc_retail_id: sanitizeFormInput(formData.metrc_retail_id, 100),
        };
        onSubmit(sanitizedData, imageFile);
    };

    const profitMargin = (cost: string, price: string) => {
        const costNum = parseFloat(cost);
        const priceNum = parseFloat(price);
        if (!costNum || !priceNum) return 0;
        return (((priceNum - costNum) / priceNum) * 100).toFixed(1);
    };

    // Handler for variant data changes from ProductVariantsManager
    const handleVariantDataChange = useCallback((variantData: Partial<ProductVariantsData>) => {
        setFormData(prev => ({
            ...prev,
            ...(variantData.prices !== undefined && { prices: variantData.prices }),
            ...(variantData.weight_grams !== undefined && { weight_grams: variantData.weight_grams?.toString() ?? "" }),
            ...(variantData.strain_name !== undefined && { strain_name: variantData.strain_name }),
            ...(variantData.strain_type !== undefined && { strain_type: variantData.strain_type }),
            ...(variantData.strain_lineage !== undefined && { strain_lineage: variantData.strain_lineage }),
            ...(variantData.thc_percent !== undefined && { thc_percent: variantData.thc_percent?.toString() ?? "" }),
            ...(variantData.cbd_percent !== undefined && { cbd_percent: variantData.cbd_percent?.toString() ?? "" }),
            ...(variantData.terpenes !== undefined && { terpenes: variantData.terpenes }),
        }));
    }, []);

    // Convert form data to variant data for the manager
    const variantData: Partial<ProductVariantsData> = {
        prices: formData.prices || {},
        weight_grams: formData.weight_grams ? parseFloat(formData.weight_grams) : null,
        strain_name: formData.strain_name,
        strain_type: formData.strain_type,
        strain_lineage: formData.strain_lineage,
        thc_percent: formData.thc_percent ? parseFloat(formData.thc_percent) : null,
        cbd_percent: formData.cbd_percent ? parseFloat(formData.cbd_percent) : null,
        terpenes: formData.terpenes || {},
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={`grid w-full ${isEditMode && productId ? 'grid-cols-2 sm:grid-cols-5 lg:w-[500px]' : 'grid-cols-2 sm:grid-cols-4 lg:w-[400px]'}`}>
                    <TabsTrigger value="details">
                        <FileText className="h-4 w-4 mr-2 hidden sm:block" /> Details
                    </TabsTrigger>
                    <TabsTrigger value="variants">
                        <Scale className="h-4 w-4 mr-2 hidden sm:block" /> Variants
                    </TabsTrigger>
                    <TabsTrigger value="pricing">
                        <DollarSign className="h-4 w-4 mr-2 hidden sm:block" /> Pricing
                    </TabsTrigger>
                    <TabsTrigger value="inventory">
                        <Package className="h-4 w-4 mr-2 hidden sm:block" /> Inventory
                    </TabsTrigger>
                    <TabsTrigger value="media">
                        <ImageIcon className="h-4 w-4 mr-2 hidden sm:block" /> Media
                    </TabsTrigger>
                    {isEditMode && productId && (
                        <TabsTrigger value="variants">
                            <Layers className="h-4 w-4 mr-2 hidden sm:block" /> Variants
                        </TabsTrigger>
                    )}
                </TabsList>

                <div className="mt-4 h-[60vh] overflow-y-auto pr-1">
                    {/* Details Tab */}
                    <TabsContent value="details" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Product Name *</Label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Blue Dream 1/8oz"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Category *</Label>
                                {hasHierarchicalCategories ? (
                                    <ProductCategorySelect
                                        value={formData.category_id}
                                        onChange={(categoryId) => {
                                            const category = getCategoryById(categoryId);
                                            setFormData({
                                                ...formData,
                                                category_id: categoryId,
                                                // Also set the category string for backwards compatibility
                                                category: category?.name.toLowerCase() || '',
                                            });
                                        }}
                                        placeholder="Select category"
                                        disabled={isLoading}
                                    />
                                ) : (
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="flower">Flower</SelectItem>
                                            <SelectItem value="edibles">Edibles</SelectItem>
                                            <SelectItem value="vapes">Vapes</SelectItem>
                                            <SelectItem value="concentrates">Concentrates</SelectItem>
                                            <SelectItem value="pre-rolls">Pre-Rolls</SelectItem>
                                            <SelectItem value="topicals">Topicals</SelectItem>
                                            <SelectItem value="gear">Gear</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Brand/Vendor</Label>
                                <AutocompleteInput
                                    value={formData.vendor_name}
                                    onChange={(value) => setFormData({ ...formData, vendor_name: value })}
                                    type="brand"
                                    placeholder="e.g. Cookies"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Strain Name</Label>
                                <AutocompleteInput
                                    value={formData.strain_name}
                                    onChange={(value) => setFormData({ ...formData, strain_name: value })}
                                    type="strain"
                                    placeholder="e.g. Gelato"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Strain Type</Label>
                                <Select
                                    value={formData.strain_type}
                                    onValueChange={(value) => setFormData({ ...formData, strain_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="indica">Indica</SelectItem>
                                        <SelectItem value="sativa">Sativa</SelectItem>
                                        <SelectItem value="hybrid">Hybrid</SelectItem>
                                        <SelectItem value="cbd">CBD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Product description..."
                                    rows={3}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Variants Tab */}
                    <TabsContent value="variants" className="space-y-4">
                        {/* ProductVariantsManager requires productId prop for editing */}
                        {isEditMode && productId ? (
                            <ProductVariantsManager productId={productId} />
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Save the product first to manage variants.</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Pricing Tab */}
                    <TabsContent value="pricing" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cost per Unit *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.cost_per_unit}
                                        onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                                        placeholder="0.00"
                                        className="pl-7"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Wholesale Price *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.wholesale_price}
                                        onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                                        placeholder="0.00"
                                        className="pl-7"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Retail Price</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.retail_price}
                                        onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                                        placeholder="0.00"
                                        className="pl-7"
                                    />
                                </div>
                            </div>
                        </div>

                        {formData.cost_per_unit && formData.wholesale_price && (
                            <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                                <span className="text-sm font-medium">Estimated Margin</span>
                                <div className="text-right">
                                    <div className="font-bold text-lg text-primary">
                                        {profitMargin(formData.cost_per_unit, formData.wholesale_price)}%
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        ${(parseFloat(formData.wholesale_price) - parseFloat(formData.cost_per_unit)).toFixed(2)} profit/unit
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center space-x-2 pt-4">
                            <Checkbox
                                id="exclude_discounts"
                                checked={formData.exclude_from_discounts}
                                onCheckedChange={(checked) => setFormData({ ...formData, exclude_from_discounts: checked as boolean })}
                            />
                            <Label htmlFor="exclude_discounts" className="cursor-pointer">
                                Exclude from Disounts
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                            If checked, this product will not be eligible for order-level discounts or promotions.
                        </p>

                        {/* Minimum Price */}
                        <div className="space-y-2 pt-4 border-t">
                            <Label>Minimum Allowed Price</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.minimum_price}
                                    onChange={(e) => setFormData({ ...formData, minimum_price: e.target.value })}
                                    placeholder="0.00"
                                    className="pl-7"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Regulatory minimum — discounts will not reduce the price below this amount.
                            </p>
                        </div>
                    </TabsContent>

                    {/* Inventory Tab */}
                    <TabsContent value="inventory" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>SKU</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        placeholder="Auto-generated if empty"
                                        readOnly={isEditMode}
                                        className={isEditMode ? "bg-muted text-muted-foreground" : ""}
                                    />
                                    <Button type="button" variant="outline" size="icon" disabled>
                                        <Barcode className="h-4 w-4" />
                                    </Button>
                                </div>
                                {!isEditMode && (
                                    <p className="text-xs text-muted-foreground">Leave empty to auto-generate</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Initial Quantity</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.available_quantity}
                                    onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
                                    placeholder="0"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Batch Number</Label>
                                <Input
                                    value={formData.batch_number}
                                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                                    placeholder="Batch #123"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Low Stock Alert</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.low_stock_alert}
                                    onChange={(e) => setFormData({ ...formData, low_stock_alert: e.target.value })}
                                    placeholder="10"
                                />
                                <p className="text-xs text-muted-foreground">Alert when stock falls below this level</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Metrc Retail ID</Label>
                                <Input
                                    value={formData.metrc_retail_id}
                                    onChange={(e) => setFormData({ ...formData, metrc_retail_id: e.target.value })}
                                    placeholder="e.g. 1A40603000..."
                                />
                                <p className="text-xs text-muted-foreground">Regulatory tracking ID to display on cart.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>THC %</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={formData.thc_percent}
                                    onChange={(e) => {
                                        setFormData({ ...formData, thc_percent: e.target.value });
                                        checkPotencyLimit('thc_percent', e.target.value);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>CBD %</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={formData.cbd_percent}
                                    onChange={(e) => {
                                        setFormData({ ...formData, cbd_percent: e.target.value });
                                        checkPotencyLimit('cbd_percent', e.target.value);
                                    }}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Media Tab */}
                    <TabsContent value="media" className="space-y-4">
                        <div className="space-y-4">
                            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleImageChange}
                                />
                                {imagePreview ? (
                                    <div className="relative w-40 h-40 rounded-lg overflow-hidden border">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <div className="bg-primary/10 p-3 rounded-full">
                                            <ImageIcon className="h-6 w-6 text-primary" />
                                        </div>
                                        <span className="font-medium">Click to upload image</span>
                                        <span className="text-xs">Max 5MB. JPG, PNG, WEBP</span>
                                    </div>
                                )}
                            </div>

                            {formData.image_url && !imagePreview && (
                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                                    <ImageIcon className="h-4 w-4" />
                                    <span>Existing image available</span>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Variants Tab (only shown when editing existing product) */}
                    {isEditMode && productId && (
                        <TabsContent value="variants" className="space-y-4">
                            <ProductVariantsManager productId={productId} />
                        </TabsContent>
                    )}
                </div>
            </Tabs >

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {isEditMode ? "Updating..." : "Creating..."}
                        </>
                    ) : (
                        isEditMode ? "Update Product" : "Create Product"
                    )}
                </Button>
            </div>
        </form >
    );
}
