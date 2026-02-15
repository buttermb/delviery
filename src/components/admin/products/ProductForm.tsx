import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput, IntegerInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Package, DollarSign, Image as ImageIcon, FileText, Barcode, Info, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

import { VendorSelector } from "@/components/admin/products/VendorSelector";
import type { VendorWithStats } from "@/hooks/useVendorsWithStats";
import { sanitizeFormInput, sanitizeTextareaInput, sanitizeSkuInput } from "@/lib/utils/sanitize";

// Define the shape of form data
export interface ProductFormData {
    name: string;
    sku: string;
    category: string;
    vendor_name: string;
    strain_name: string;
    strain_type: string;
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
}

interface ProductFormProps {
    initialData?: Partial<ProductFormData>;
    onSubmit: (data: ProductFormData, imageFile: File | null) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
    isEditMode: boolean;
    storeSettings?: any; // Pass in settings for potency limits
}

const DEFAULT_FORM_DATA: ProductFormData = {
    name: "",
    sku: "",
    category: "flower",
    vendor_name: "",
    strain_name: "",
    strain_type: "",
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
};

export function ProductForm({
    initialData,
    onSubmit,
    onCancel,
    isLoading,
    isEditMode,
    storeSettings,
}: ProductFormProps) {
    const MAX_FILE_SIZE_MB = 2;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM_DATA);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageProgress, setImageProgress] = useState(0);
    const [activeTab, setActiveTab] = useState("details");
    const [selectedVendor, setSelectedVendor] = useState<VendorWithStats | null>(null);

    const checkPotencyLimit = (field: 'thc_percent' | 'cbd_percent', value: string) => {
        const numVal = parseFloat(value);
        if (!storeSettings || isNaN(numVal)) return;

        const limit = field === 'thc_percent' ? storeSettings.potency_limit_thc : storeSettings.potency_limit_cbd;

        if (limit && numVal > limit) {
            toast.warning(`Potency Alert: Value exceeds store limit of ${limit}%`);
        }
    };

    // Handle vendor selection with auto-population of vendor-specific fields
    const handleVendorSelect = useCallback((vendor: VendorWithStats | null) => {
        setSelectedVendor(vendor);
        // Auto-populate vendor-specific fields when a vendor is selected
        // This provides a starting point but doesn't overwrite if user already entered values
    }, []);

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

        // Reset input so same file can be re-selected
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            toast.error('Invalid file type');
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`File too large (max ${MAX_FILE_SIZE_MB}MB). Selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
            return;
        }

        setImageFile(file);

        // Show local preview immediately
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);

        // Simulate progress for visual feedback
        setImageUploading(true);
        setImageProgress(0);
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 15;
            if (progress >= 100) {
                clearInterval(progressInterval);
                setImageProgress(100);
                setTimeout(() => {
                    setImageUploading(false);
                    setImageProgress(0);
                }, 300);
            } else {
                setImageProgress(progress);
            }
        }, 100);
    };

    const removeImage = () => {
        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        setImageFile(null);
        setImagePreview(null);
        setFormData((prev) => ({ ...prev, image_url: '' }));
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

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-[400px]">
                    <TabsTrigger value="details">
                        <FileText className="h-4 w-4 mr-2 hidden sm:block" /> Details
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
                            </div>

                            <div className="space-y-2">
                                <Label>Brand/Vendor</Label>
                                <VendorSelector
                                    value={formData.vendor_name}
                                    onChange={(value) => setFormData({ ...formData, vendor_name: value })}
                                    onVendorSelect={handleVendorSelect}
                                    placeholder="Select or enter vendor..."
                                    allowCreate
                                />
                                {selectedVendor && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Info className="h-3 w-3" />
                                        {selectedVendor.payment_terms && (
                                            <span>Terms: {selectedVendor.payment_terms}</span>
                                        )}
                                        {selectedVendor.lead_time_days !== null && (
                                            <span className="ml-2">Lead: {selectedVendor.lead_time_days}d</span>
                                        )}
                                    </div>
                                )}
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

                    {/* Pricing Tab */}
                    <TabsContent value="pricing" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cost per Unit *</Label>
                                <CurrencyInput
                                    required
                                    value={formData.cost_per_unit}
                                    onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Wholesale Price *</Label>
                                <CurrencyInput
                                    required
                                    value={formData.wholesale_price}
                                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Retail Price</Label>
                                <CurrencyInput
                                    value={formData.retail_price}
                                    onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                                    placeholder="0.00"
                                />
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
                            <CurrencyInput
                                value={formData.minimum_price}
                                onChange={(e) => setFormData({ ...formData, minimum_price: e.target.value })}
                                placeholder="0.00"
                            />
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
                                <IntegerInput
                                    min={0}
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
                                <IntegerInput
                                    min={0}
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
                            {imagePreview || formData.image_url ? (
                                <div className="relative group border-2 border-dashed rounded-lg overflow-hidden">
                                    <img
                                        src={imagePreview || formData.image_url}
                                        alt="Product preview"
                                        className="w-full h-64 object-cover"
                                    />
                                    {imageUploading && (
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                                            <Progress value={imageProgress} className="w-48" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <label className="cursor-pointer">
                                            <Button type="button" variant="secondary" size="sm" asChild>
                                                <span>
                                                    <ImageIcon className="h-4 w-4 mr-2" />
                                                    Replace
                                                </span>
                                            </Button>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageChange}
                                            />
                                        </label>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={removeImage}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleImageChange}
                                    />
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <div className="bg-primary/10 p-3 rounded-full">
                                            <ImageIcon className="h-6 w-6 text-primary" />
                                        </div>
                                        <span className="font-medium">Click to upload image</span>
                                        <span className="text-xs">Max {MAX_FILE_SIZE_MB}MB. JPG, PNG, WEBP</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
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
