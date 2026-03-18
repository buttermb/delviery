import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { humanizeError } from "@/lib/humanizeError";
import { Loader2, Save, Store, Palette, Truck, Upload } from "lucide-react";
import { MarketplaceProfile } from "@/types/marketplace-extended";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { queryKeys } from '@/lib/queryKeys';

export default function StoreSettings() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("general");

    // Fetch store profile
    const { data: profile, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) throw new Error("No tenant ID");

            const { data, error } = await supabase
                .from('marketplace_profiles')
                .select('id, tenant_id, business_name, business_description, logo_url, cover_image_url, marketplace_status, verified_badge, shipping_states, shipping_policy, return_policy, slug, created_at, updated_at')
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (error) {
                logger.error("Error fetching profile", error);
                return null;
            }
            return data as MarketplaceProfile | null;
        },
        enabled: !!tenant?.id,
        retry: false
    });

    // Update mutation
    const updateProfile = useMutation({
        mutationFn: async (updates: Partial<MarketplaceProfile>) => {
            if (!tenant?.id) throw new Error("No tenant ID");

            // Check if profile exists, if not create it
            if (!profile) {
                const { data, error } = await supabase
                    .from('marketplace_profiles')
                    .insert([{
                        tenant_id: tenant.id,
                        business_name: tenant.business_name, // Default to tenant name
                        ...updates
                    }])
                    .select()
                    .maybeSingle();

                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from('marketplace_profiles')
                    .update(updates)
                    .eq('tenant_id', tenant.id)
                    .select()
                    .maybeSingle();

                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProfileAdmin.byTenant() });
            toast.success("Store settings updated successfully");
        },
        onError: (error) => {
            toast.error(humanizeError(error, "Failed to update settings"));
        }
    });

    const [formState, setFormState] = useState<Partial<MarketplaceProfile>>({});

    const handleSave = () => {
        updateProfile.mutate(formState);
        setFormState({}); // Clear local state after save? Or keep it?
        // Better to not clear if we want to keep editing, but query invalidation will refresh 'profile'
    };

    const handleChange = (field: keyof MarketplaceProfile, value: string | boolean | string[] | null) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    if (isLoading) {
        return <EnhancedLoadingState variant="card" message="Loading settings..." />;
    }

    const currentProfile = { ...profile, ...formState } as MarketplaceProfile;

    return (
        <div className="space-y-4 max-w-5xl mx-auto p-4 md:p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Store Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure your public storefront appearance and policies.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={updateProfile.isPending || Object.keys(formState).length === 0}
                >
                    {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general" className="gap-2"><Store className="h-4 w-4" /> General</TabsTrigger>
                    <TabsTrigger value="branding" className="gap-2"><Palette className="h-4 w-4" /> Branding</TabsTrigger>
                    <TabsTrigger value="delivery" className="gap-2"><Truck className="h-4 w-4" /> Policies</TabsTrigger>
                    {/* <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" /> Payments</TabsTrigger> */}
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
                                    defaultValue={profile?.business_name ?? tenant?.business_name}
                                    onChange={(e) => handleChange('business_name', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="business_description">Description</Label>
                                <Textarea
                                    id="business_description"
                                    placeholder="Tell customers about your store..."
                                    className="min-h-[100px]"
                                    defaultValue={profile?.business_description ?? ''}
                                    onChange={(e) => handleChange('business_description', e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between border p-4 rounded-lg bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label>Store Visibility</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Enable or disable your public storefront.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={currentProfile?.marketplace_status === 'active'}
                                        onCheckedChange={(checked) => handleChange('marketplace_status', checked ? 'active' : 'suspended')}
                                    />
                                    <span className="text-sm font-medium">
                                        {currentProfile?.marketplace_status === 'active' ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            {profile?.verified_badge && (
                                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded text-sm">
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Verified</Badge>
                                    Your store is verified and has a trusted badge.
                                </div>
                            )}
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
                            <div className="grid gap-2">
                                <Label>Store Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                                        {currentProfile?.logo_url ? (
                                            <img src={currentProfile.logo_url} alt="Logo" className="h-full w-full object-cover" loading="lazy" />
                                        ) : (
                                            <Store className="h-8 w-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm">
                                        <Upload className="mr-2 h-4 w-4" /> Upload Logo
                                    </Button>
                                </div>
                                <Input
                                    placeholder="Or Image URL"
                                    aria-label="Logo image URL"
                                    value={currentProfile?.logo_url ?? ''}
                                    onChange={(e) => handleChange('logo_url', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Cover Image</Label>
                                <div className="h-40 w-full rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                                    {currentProfile?.cover_image_url ? (
                                        <img src={currentProfile.cover_image_url} alt="Cover" className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                        <p className="text-muted-foreground">No cover image set</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">
                                        <Upload className="mr-2 h-4 w-4" /> Upload Cover
                                    </Button>
                                    <Input
                                        placeholder="Or Image URL"
                                        aria-label="Cover image URL"
                                        className="flex-1"
                                        value={currentProfile?.cover_image_url ?? ''}
                                        onChange={(e) => handleChange('cover_image_url', e.target.value)}
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
                                    defaultValue={profile?.shipping_policy ?? ''}
                                    onChange={(e) => handleChange('shipping_policy', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="return_policy">Return Policy</Label>
                                <Textarea
                                    id="return_policy"
                                    placeholder="Explain your return and refund policy..."
                                    className="min-h-[150px]"
                                    defaultValue={profile?.return_policy ?? ''}
                                    onChange={(e) => handleChange('return_policy', e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Shipping States</Label>
                                <p className="text-sm text-muted-foreground mb-2">Comma separated list of state codes (e.g. CA, NY, TX)</p>
                                <Input
                                    placeholder="CA, NY, NV"
                                    defaultValue={profile?.shipping_states?.join(', ') ?? ''}
                                    onChange={(e) => {
                                        const states = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        handleChange('shipping_states', states);
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
