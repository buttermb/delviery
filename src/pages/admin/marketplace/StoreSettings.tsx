import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { humanizeError } from "@/lib/humanizeError";
import { Loader2, Save, Store, Palette, Truck, Upload, X } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { compressImage, isCompressibleImage, COMPRESSION_PRESETS } from "@/lib/utils/image-compression";

interface StoreProfileData {
    id: string;
    tenant_id: string;
    business_name: string | null;
    business_description: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    marketplace_status: string | null;
    can_sell: boolean | null;
    shipping_states: string[] | null;
    shipping_policy: string | null;
    return_policy: string | null;
    created_at: string | null;
    updated_at: string | null;
}

type ProfileUpdates = Partial<Pick<StoreProfileData,
    'business_name' | 'business_description' | 'logo_url' | 'cover_image_url' |
    'marketplace_status' | 'shipping_states' | 'shipping_policy' | 'return_policy'
>>;

const BUSINESS_NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;
const POLICY_MAX = 5000;
const URL_MAX = 500;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

function StoreSettingsSkeleton() {
    return (
        <div className="space-y-4 max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-9 w-32" />
            </div>
            <Skeleton className="h-10 w-80" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                    <Skeleton className="h-16 w-full rounded-lg" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function StoreSettings() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("general");
    const [formState, setFormState] = useState<ProfileUpdates>({});
    const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const { data: profile, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) throw new Error("No tenant ID");

            const { data, error } = await supabase
                .from("marketplace_profiles")
                .select("id, tenant_id, business_name, business_description, logo_url, cover_image_url, marketplace_status, can_sell, shipping_states, shipping_policy, return_policy, created_at, updated_at")
                .eq("tenant_id", tenant.id)
                .maybeSingle();

            if (error) {
                logger.error("Error fetching marketplace profile", error);
                return null;
            }
            return data as StoreProfileData | null;
        },
        enabled: !!tenant?.id,
        staleTime: 60_000,
        retry: 1,
    });

    const updateProfile = useMutation({
        mutationFn: async (updates: ProfileUpdates) => {
            if (!tenant?.id) throw new Error("No tenant ID");

            if (!profile) {
                const { data, error } = await supabase
                    .from("marketplace_profiles")
                    .insert([{
                        tenant_id: tenant.id,
                        business_name: tenant.business_name,
                        ...updates,
                    }])
                    .select()
                    .maybeSingle();

                if (error) throw error;
                return data;
            }

            const { data, error } = await supabase
                .from("marketplace_profiles")
                .update(updates)
                .eq("tenant_id", tenant.id)
                .select()
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            setFormState({});
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id) });
            toast.success("Store settings updated successfully");
        },
        onError: (error: Error) => {
            toast.error(humanizeError(error, "Failed to update settings"));
        },
    });

    const handleSave = () => {
        if (Object.keys(formState).length === 0) return;

        const name = formState.business_name ?? profile?.business_name;
        if (name !== undefined && (!name || name.trim().length < 2)) {
            toast.error("Business name must be at least 2 characters");
            return;
        }

        updateProfile.mutate(formState);
    };

    const handleChange = (field: keyof ProfileUpdates, value: string | string[] | null) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const uploadFile = async (file: File, type: "logo" | "cover") => {
        if (!tenant?.id) {
            toast.error("Tenant context not available");
            return;
        }

        setUploading(type);
        try {
            let fileToUpload = file;

            if (isCompressibleImage(file)) {
                const preset = type === "logo" ? COMPRESSION_PRESETS.profile : COMPRESSION_PRESETS.cover;
                fileToUpload = await compressImage(file, preset);
            }

            const fileExt = file.name.split(".").pop();
            const fileName = `${type}-${Date.now()}.${fileExt}`;
            const filePath = `${tenant.id}/marketplace/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("product-images")
                .upload(filePath, fileToUpload, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("product-images")
                .getPublicUrl(filePath);

            const field = type === "logo" ? "logo_url" : "cover_image_url";
            handleChange(field, publicUrl);
            toast.success(`${type === "logo" ? "Logo" : "Cover image"} uploaded`);
        } catch (error) {
            logger.error("File upload failed", error, { component: "StoreSettings", type });
            toast.error(`Failed to upload ${type === "logo" ? "logo" : "cover image"}`);
        } finally {
            setUploading(null);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") => {
        const file = event.target.files?.[0];
        if (!file) return;

        const maxSize = type === "logo" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error(`File too large. Maximum ${type === "logo" ? "5MB" : "10MB"}`);
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        uploadFile(file, type);
        event.target.value = "";
    };

    if (isLoading) {
        return <StoreSettingsSkeleton />;
    }

    const currentProfile: Partial<StoreProfileData> = { ...profile, ...formState };
    const isDirty = Object.keys(formState).length > 0;

    return (
        <div className="space-y-4 max-w-5xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Store Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure your public storefront appearance and policies.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={updateProfile.isPending || !isDirty}
                    aria-label="Save store settings"
                >
                    {updateProfile.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general" className="gap-2">
                        <Store className="h-4 w-4" /> General
                    </TabsTrigger>
                    <TabsTrigger value="branding" className="gap-2">
                        <Palette className="h-4 w-4" /> Branding
                    </TabsTrigger>
                    <TabsTrigger value="delivery" className="gap-2">
                        <Truck className="h-4 w-4" /> Policies
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Information</CardTitle>
                            <CardDescription>Basic details about your marketplace store.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="business_name">Business Name</Label>
                                <Input
                                    id="business_name"
                                    maxLength={BUSINESS_NAME_MAX}
                                    defaultValue={profile?.business_name ?? tenant?.business_name ?? ""}
                                    onChange={(e) => handleChange("business_name", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {(currentProfile.business_name ?? "").length}/{BUSINESS_NAME_MAX}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="business_description">Description</Label>
                                <Textarea
                                    id="business_description"
                                    placeholder="Tell customers about your store..."
                                    className="min-h-[100px]"
                                    maxLength={DESCRIPTION_MAX}
                                    defaultValue={profile?.business_description ?? ""}
                                    onChange={(e) => handleChange("business_description", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {(currentProfile.business_description ?? "").length}/{DESCRIPTION_MAX}
                                </p>
                            </div>

                            <div className="flex items-center justify-between border p-4 rounded-lg bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label htmlFor="store_visibility">Store Visibility</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable or disable your public storefront.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="store_visibility"
                                        checked={currentProfile.marketplace_status === "active"}
                                        onCheckedChange={(checked) =>
                                            handleChange("marketplace_status", checked ? "active" : "suspended")
                                        }
                                        aria-label="Toggle store visibility"
                                    />
                                    <span className="text-sm font-medium">
                                        {currentProfile.marketplace_status === "active" ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="branding">
                    <Card>
                        <CardHeader>
                            <CardTitle>Branding Assets</CardTitle>
                            <CardDescription>Upload your logo and cover image.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES}
                                className="hidden"
                                onChange={(e) => handleFileSelect(e, "logo")}
                            />
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES}
                                className="hidden"
                                onChange={(e) => handleFileSelect(e, "cover")}
                            />

                            <div className="grid gap-2">
                                <Label>Store Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {currentProfile.logo_url ? (
                                            <img
                                                src={currentProfile.logo_url}
                                                alt="Store logo"
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Store className="h-8 w-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => logoInputRef.current?.click()}
                                            disabled={uploading === "logo"}
                                            aria-label="Upload store logo"
                                        >
                                            {uploading === "logo" ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Upload className="mr-2 h-4 w-4" />
                                            )}
                                            Upload Logo
                                        </Button>
                                        {currentProfile.logo_url && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleChange("logo_url", null)}
                                                aria-label="Remove store logo"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <Input
                                    placeholder="Or paste image URL"
                                    aria-label="Logo image URL"
                                    maxLength={URL_MAX}
                                    value={currentProfile.logo_url ?? ""}
                                    onChange={(e) => handleChange("logo_url", e.target.value || null)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Cover Image</Label>
                                <div className="h-40 w-full rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                                    {currentProfile.cover_image_url ? (
                                        <img
                                            src={currentProfile.cover_image_url}
                                            alt="Store cover"
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <p className="text-muted-foreground">No cover image set</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => coverInputRef.current?.click()}
                                        disabled={uploading === "cover"}
                                        aria-label="Upload cover image"
                                    >
                                        {uploading === "cover" ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="mr-2 h-4 w-4" />
                                        )}
                                        Upload Cover
                                    </Button>
                                    {currentProfile.cover_image_url && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleChange("cover_image_url", null)}
                                            aria-label="Remove cover image"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Input
                                        placeholder="Or paste image URL"
                                        aria-label="Cover image URL"
                                        maxLength={URL_MAX}
                                        className="flex-1"
                                        value={currentProfile.cover_image_url ?? ""}
                                        onChange={(e) => handleChange("cover_image_url", e.target.value || null)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="delivery">
                    <Card>
                        <CardHeader>
                            <CardTitle>Store Policies</CardTitle>
                            <CardDescription>Set your shipping and return policies.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="shipping_policy">Shipping Policy</Label>
                                <Textarea
                                    id="shipping_policy"
                                    placeholder="Explain your shipping rates, times, and restrictions..."
                                    className="min-h-[150px]"
                                    maxLength={POLICY_MAX}
                                    defaultValue={profile?.shipping_policy ?? ""}
                                    onChange={(e) => handleChange("shipping_policy", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {(currentProfile.shipping_policy ?? "").length}/{POLICY_MAX}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="return_policy">Return Policy</Label>
                                <Textarea
                                    id="return_policy"
                                    placeholder="Explain your return and refund policy..."
                                    className="min-h-[150px]"
                                    maxLength={POLICY_MAX}
                                    defaultValue={profile?.return_policy ?? ""}
                                    onChange={(e) => handleChange("return_policy", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {(currentProfile.return_policy ?? "").length}/{POLICY_MAX}
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="shipping_states">Shipping States</Label>
                                <p className="text-sm text-muted-foreground">
                                    Comma-separated list of state codes (e.g. CA, NY, TX)
                                </p>
                                <Input
                                    id="shipping_states"
                                    placeholder="CA, NY, NV"
                                    defaultValue={profile?.shipping_states?.join(", ") ?? ""}
                                    onChange={(e) => {
                                        const states = e.target.value
                                            .split(",")
                                            .map((s) => s.trim().toUpperCase())
                                            .filter(Boolean);
                                        handleChange("shipping_states", states);
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
