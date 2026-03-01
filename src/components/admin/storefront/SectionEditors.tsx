import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Star, Monitor, Tablet, Smartphone, Pencil } from 'lucide-react';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { TestimonialsSectionEditDialog } from '@/components/admin/storefront/TestimonialsSectionEditDialog';
import { FeaturesEditDialog } from '@/components/admin/storefront/FeaturesEditDialog';
import { FEATURES_ICON_MAP } from '@/components/shop/sections/featuresIconMap';

interface SectionConfig {
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
    responsive?: {
        mobile?: { padding_y?: string; hidden?: boolean };
        tablet?: { padding_y?: string; hidden?: boolean };
        desktop?: { padding_y?: string; hidden?: boolean };
    };
}

interface SectionEditorProps {
    section: SectionConfig;
    onUpdateContent: (key: string, value: unknown) => void;
    onUpdateStyles: (key: string, value: unknown) => void;
    onUpdateResponsive: (device: 'mobile' | 'tablet' | 'desktop', key: string, value: unknown) => void;
}

// Color picker + hex input combo
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <div className="flex gap-2 items-center">
                <Input
                    type="color"
                    className="w-8 h-8 p-0 border-0 cursor-pointer rounded"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                />
                <Input
                    className="flex-1 h-8 text-xs"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}

// ─── Hero Section Editor ────────────────────────────────────────────────────

function HeroEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'styles', 'cta']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Headline</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Line 1</Label>
                            <Input
                                value={(content.heading_line_1 as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading_line_1', e.target.value)}
                                placeholder="Premium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Line 2 (Gradient)</Label>
                            <Input
                                value={(content.heading_line_2 as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading_line_2', e.target.value)}
                                placeholder="Flower"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Line 3</Label>
                            <Input
                                value={(content.heading_line_3 as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading_line_3', e.target.value)}
                                placeholder="Delivered"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Textarea
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="Curated strains. Same-day delivery."
                                rows={2}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Announcement Banner</Label>
                            <Input
                                value={(content.announcement_banner as string) ?? ''}
                                onChange={(e) => onUpdateContent('announcement_banner', e.target.value)}
                                placeholder="Free delivery on orders over $100"
                            />
                            <p className="text-[10px] text-muted-foreground">Optional banner shown above the hero. Leave empty to hide.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={(content.trust_badges as boolean) ?? true}
                                onCheckedChange={(v) => onUpdateContent('trust_badges', v)}
                            />
                            <Label className="text-xs">Show Trust Badges</Label>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cta">
                    <AccordionTrigger className="text-sm font-medium">Call to Action</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Primary Button Text</Label>
                            <Input
                                value={(content.cta_primary_text as string) ?? ''}
                                onChange={(e) => onUpdateContent('cta_primary_text', e.target.value)}
                                placeholder="Explore Collection"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Primary Button Link</Label>
                            <Input
                                value={(content.cta_primary_link as string) ?? ''}
                                onChange={(e) => onUpdateContent('cta_primary_link', e.target.value)}
                                placeholder="/shop"
                            />
                        </div>
                        <Separator className="my-2" />
                        <div className="space-y-1.5">
                            <Label className="text-xs">Secondary Button Text</Label>
                            <Input
                                value={(content.cta_secondary_text as string) ?? ''}
                                onChange={(e) => onUpdateContent('cta_secondary_text', e.target.value)}
                                placeholder="View Menu"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Secondary Button Link</Label>
                            <Input
                                value={(content.cta_secondary_link as string) ?? ''}
                                onChange={(e) => onUpdateContent('cta_secondary_link', e.target.value)}
                                placeholder="/menu"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Gradient Start"
                            value={(styles.background_gradient_start as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('background_gradient_start', v)}
                        />
                        <ColorField
                            label="Gradient End"
                            value={(styles.background_gradient_end as string) || '#022c22'}
                            onChange={(v) => onUpdateStyles('background_gradient_end', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#34d399'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Features Section Editor ────────────────────────────────────────────────

interface FeatureItem {
    icon: string;
    title: string;
    description: string;
}

function FeaturesEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const features = (content.features as FeatureItem[]) ?? [];

    const updateFeature = (index: number, key: keyof FeatureItem, value: string) => {
        const updated = [...features];
        updated[index] = { ...updated[index], [key]: value };
        onUpdateContent('features', updated);
    };

    const addFeature = () => {
        onUpdateContent('features', [...features, { icon: 'star', title: 'New Feature', description: 'Feature description' }]);
    };

    const removeFeature = (index: number) => {
        onUpdateContent('features', features.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'features', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Heading</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Small Heading</Label>
                            <Input
                                value={(content.heading_small as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading_small', e.target.value)}
                                placeholder="The Difference"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Large Heading</Label>
                            <Input
                                value={(content.heading_large as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading_large', e.target.value)}
                                placeholder="Excellence in Every Detail"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="features">
                    <AccordionTrigger className="text-sm font-medium">Features ({features.length})</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={() => setDialogOpen(true)}
                        >
                            <Pencil className="w-3 h-3" /> Edit Features in Dialog
                        </Button>
                        {features.map((feature, index) => {
                            const Icon = FEATURES_ICON_MAP[feature.icon];
                            return (
                                <div key={index} className="p-3 border rounded-lg space-y-2 relative">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            {Icon ? <Icon className="w-3 h-3" /> : null}
                                            {feature.title || `Feature ${index + 1}`}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeFeature(index)}
                                            aria-label="Remove feature"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <Input
                                        value={feature.title}
                                        onChange={(e) => updateFeature(index, 'title', e.target.value)}
                                        placeholder="Feature title"
                                        className="h-8 text-xs"
                                    />
                                    <Textarea
                                        value={feature.description}
                                        onChange={(e) => updateFeature(index, 'description', e.target.value)}
                                        placeholder="Description"
                                        rows={2}
                                        className="text-xs"
                                    />
                                </div>
                            );
                        })}
                        <Button variant="outline" size="sm" className="w-full" onClick={addFeature}>
                            <Plus className="w-3 h-3 mr-1" /> Add Feature
                        </Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#171717'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Icon Color"
                            value={(styles.icon_color as string) || '#34d399'}
                            onChange={(v) => onUpdateStyles('icon_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <FeaturesEditDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                features={features}
                onSave={(updated) => onUpdateContent('features', updated)}
            />
        </div>
    );
}

// ─── Product Grid Section Editor ────────────────────────────────────────────

function ProductGridEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'grid', 'options', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Heading</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Title</Label>
                            <Input
                                value={(content.heading as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading', e.target.value)}
                                placeholder="Shop Collection"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Input
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="Curated selection."
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="grid">
                    <AccordionTrigger className="text-sm font-medium">Grid Settings</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Columns</Label>
                            <Select
                                value={String((content.columns as number) || 4)}
                                onValueChange={(v) => onUpdateContent('columns', Number(v))}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select columns" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2">2 columns</SelectItem>
                                    <SelectItem value="3">3 columns</SelectItem>
                                    <SelectItem value="4">4 columns</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max Products</Label>
                            <Select
                                value={String((content.max_products as number) || 20)}
                                onValueChange={(v) => onUpdateContent('max_products', Number(v))}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select max" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4">4 products</SelectItem>
                                    <SelectItem value="8">8 products</SelectItem>
                                    <SelectItem value="12">12 products</SelectItem>
                                    <SelectItem value="16">16 products</SelectItem>
                                    <SelectItem value="20">20 products</SelectItem>
                                    <SelectItem value="50">50 products</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Sort Order</Label>
                            <Select
                                value={(content.sort_order as string) || 'newest'}
                                onValueChange={(v) => onUpdateContent('sort_order', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest First</SelectItem>
                                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                                    <SelectItem value="name_asc">Name: A to Z</SelectItem>
                                    <SelectItem value="name_desc">Name: Z to A</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Category Filter</Label>
                            <Select
                                value={(content.category_filter as string) || 'all'}
                                onValueChange={(v) => onUpdateContent('category_filter', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="flower">Flower</SelectItem>
                                    <SelectItem value="edibles">Edibles</SelectItem>
                                    <SelectItem value="pre-rolls">Pre-Rolls</SelectItem>
                                    <SelectItem value="concentrates">Concentrates</SelectItem>
                                    <SelectItem value="vapes">Vapes</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Show only products from a specific category</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show &quot;View All&quot; Link</Label>
                            <Switch
                                checked={(content.show_view_all_link as boolean) ?? true}
                                onCheckedChange={(v) => onUpdateContent('show_view_all_link', v)}
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="options">
                    <AccordionTrigger className="text-sm font-medium">Display Options</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Search Bar</Label>
                            <Switch
                                checked={(content.show_search as boolean) ?? true}
                                onCheckedChange={(v) => onUpdateContent('show_search', v)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Categories</Label>
                            <Switch
                                checked={(content.show_categories as boolean) ?? true}
                                onCheckedChange={(v) => onUpdateContent('show_categories', v)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Premium Filter</Label>
                            <Switch
                                checked={(content.show_premium_filter as boolean) ?? true}
                                onCheckedChange={(v) => onUpdateContent('show_premium_filter', v)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Initial Categories Shown</Label>
                            <Select
                                value={String((content.initial_categories_shown as number) || 2)}
                                onValueChange={(v) => onUpdateContent('initial_categories_shown', Number(v))}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select count" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                    <SelectItem value="4">4</SelectItem>
                                    <SelectItem value="5">5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#f4f4f5'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Testimonials Section Editor ────────────────────────────────────────────

interface TestimonialItem {
    name: string;
    role: string;
    quote: string;
    rating: number;
}

function TestimonialsEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const testimonials = (content.testimonials as TestimonialItem[]) ?? [];
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const updateTestimonial = (index: number, key: keyof TestimonialItem, value: string | number) => {
        const updated = [...testimonials];
        updated[index] = { ...updated[index], [key]: value };
        onUpdateContent('testimonials', updated);
    };

    const addTestimonial = () => {
        onUpdateContent('testimonials', [
            ...testimonials,
            { name: 'Customer Name', role: 'Verified Customer', quote: 'Great experience!', rating: 5 }
        ]);
    };

    const removeTestimonial = (index: number) => {
        onUpdateContent('testimonials', testimonials.filter((_, i) => i !== index));
    };

    const handleDialogSave = (saved: { heading: string; subheading: string; testimonials: TestimonialItem[] }) => {
        onUpdateContent('heading', saved.heading);
        onUpdateContent('subheading', saved.subheading);
        onUpdateContent('testimonials', saved.testimonials);
    };

    return (
        <div className="space-y-4">
            <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setEditDialogOpen(true)}
            >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit in Dialog
            </Button>

            <TestimonialsSectionEditDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                content={content}
                onSave={handleDialogSave}
            />

            <Accordion type="multiple" defaultValue={['content', 'items', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Heading</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Heading</Label>
                            <Input
                                value={(content.heading as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading', e.target.value)}
                                placeholder="What Our Customers Say"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Input
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="Join thousands of satisfied customers"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="items">
                    <AccordionTrigger className="text-sm font-medium">Testimonials ({testimonials.length})</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {testimonials.map((item, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Testimonial {index + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeTestimonial(index)}
                                        aria-label="Remove testimonial"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                                <Input
                                    value={item.name}
                                    onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                                    placeholder="Customer name"
                                    className="h-8 text-xs"
                                />
                                <Input
                                    value={item.role}
                                    onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                                    placeholder="Role / Title"
                                    className="h-8 text-xs"
                                />
                                <Textarea
                                    value={item.quote}
                                    onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                                    placeholder="Their testimonial..."
                                    rows={2}
                                    className="text-xs"
                                />
                                <div className="space-y-1">
                                    <Label className="text-xs">Rating</Label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => updateTestimonial(index, 'rating', star)}
                                                className="p-0.5"
                                            >
                                                <Star
                                                    className="w-4 h-4"
                                                    fill={star <= item.rating ? '#f59e0b' : 'transparent'}
                                                    stroke={star <= item.rating ? '#f59e0b' : '#d1d5db'}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full" onClick={addTestimonial}>
                            <Plus className="w-3 h-3 mr-1" /> Add Testimonial
                        </Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                        <ColorField
                            label="Card Background"
                            value={(styles.card_background as string) || '#f9fafb'}
                            onChange={(v) => onUpdateStyles('card_background', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Newsletter Section Editor ──────────────────────────────────────────────

function NewsletterEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Content</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Heading</Label>
                            <Input
                                value={(content.heading as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading', e.target.value)}
                                placeholder="Stay in the Loop"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Input
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="Subscribe for exclusive drops."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Button Text</Label>
                            <Input
                                value={(content.button_text as string) ?? ''}
                                onChange={(e) => onUpdateContent('button_text', e.target.value)}
                                placeholder="Subscribe"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Input Placeholder</Label>
                            <Input
                                value={(content.placeholder_text as string) ?? ''}
                                onChange={(e) => onUpdateContent('placeholder_text', e.target.value)}
                                placeholder="Enter your email"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Success Message</Label>
                            <Input
                                value={(content.success_message as string) ?? ''}
                                onChange={(e) => onUpdateContent('success_message', e.target.value)}
                                placeholder="Thanks for subscribing!"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Gradient Start"
                            value={(styles.background_gradient_start as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('background_gradient_start', v)}
                        />
                        <ColorField
                            label="Gradient End"
                            value={(styles.background_gradient_end as string) || '#1f2937'}
                            onChange={(v) => onUpdateStyles('background_gradient_end', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                        <ColorField
                            label="Button Color"
                            value={(styles.button_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('button_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Gallery Section Editor ─────────────────────────────────────────────────

interface GalleryImage {
    url: string;
    alt: string;
}

function GalleryEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const images = (content.images as GalleryImage[]) ?? [];

    const updateImage = (index: number, key: keyof GalleryImage, value: string) => {
        const updated = [...images];
        updated[index] = { ...updated[index], [key]: value };
        onUpdateContent('images', updated);
    };

    const addImage = () => {
        onUpdateContent('images', [...images, { url: '', alt: 'New image' }]);
    };

    const removeImage = (index: number) => {
        onUpdateContent('images', images.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'images', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Heading</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Heading</Label>
                            <Input
                                value={(content.heading as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading', e.target.value)}
                                placeholder="Gallery"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Input
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="A curated visual experience"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Layout Style</Label>
                            <Select
                                value={(content.layout as string) || 'masonry'}
                                onValueChange={(v) => onUpdateContent('layout', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select layout" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="masonry">Masonry</SelectItem>
                                    <SelectItem value="grid">Grid (Uniform)</SelectItem>
                                    <SelectItem value="carousel">Carousel</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="images">
                    <AccordionTrigger className="text-sm font-medium">Images ({images.length})</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {images.map((image, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Image {index + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeImage(index)}
                                        aria-label="Remove image"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Image URL</Label>
                                    <Input
                                        value={image.url}
                                        onChange={(e) => updateImage(index, 'url', e.target.value)}
                                        placeholder="https://..."
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Alt Text</Label>
                                    <Input
                                        value={image.alt}
                                        onChange={(e) => updateImage(index, 'alt', e.target.value)}
                                        placeholder="Image description"
                                        className="h-8 text-xs"
                                    />
                                </div>
                                {image.url && (
                                    <img
                                        src={image.url}
                                        alt={image.alt}
                                        className="w-full h-16 object-cover rounded"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        loading="lazy"
                                    />
                                )}
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full" onClick={addImage}>
                            <Plus className="w-3 h-3 mr-1" /> Add Image
                        </Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── FAQ Section Editor ─────────────────────────────────────────────────────

interface FAQItem {
    question: string;
    answer: string;
}

function FAQEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const faqs = (content.faqs as FAQItem[]) ?? [];

    const updateFAQ = (index: number, key: keyof FAQItem, value: string) => {
        const updated = [...faqs];
        updated[index] = { ...updated[index], [key]: value };
        onUpdateContent('faqs', updated);
    };

    const addFAQ = () => {
        onUpdateContent('faqs', [...faqs, { question: 'New question?', answer: 'Answer here.' }]);
    };

    const removeFAQ = (index: number) => {
        onUpdateContent('faqs', faqs.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'items', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Heading</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Heading</Label>
                            <Input
                                value={(content.heading as string) ?? ''}
                                onChange={(e) => onUpdateContent('heading', e.target.value)}
                                placeholder="Frequently Asked Questions"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Subheading</Label>
                            <Input
                                value={(content.subheading as string) ?? ''}
                                onChange={(e) => onUpdateContent('subheading', e.target.value)}
                                placeholder="Got questions? We've got answers."
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="items">
                    <AccordionTrigger className="text-sm font-medium">Questions ({faqs.length})</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {faqs.map((faq, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeFAQ(index)}
                                        aria-label="Remove FAQ"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Question</Label>
                                    <Input
                                        value={faq.question}
                                        onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                                        placeholder="Question?"
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Answer</Label>
                                    <Textarea
                                        value={faq.answer}
                                        onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                                        placeholder="Answer..."
                                        rows={2}
                                        className="text-xs"
                                    />
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full" onClick={addFAQ}>
                            <Plus className="w-3 h-3 mr-1" /> Add Question
                        </Button>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#f9fafb'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <ColorField
                            label="Accent Color"
                            value={(styles.accent_color as string) || '#10b981'}
                            onChange={(v) => onUpdateStyles('accent_color', v)}
                        />
                        <ColorField
                            label="Border Color"
                            value={(styles.border_color as string) || '#e5e7eb'}
                            onChange={(v) => onUpdateStyles('border_color', v)}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Custom HTML Section Editor ─────────────────────────────────────────────

function CustomHTMLEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const [showPreview, setShowPreview] = useState(false);

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Content</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Section Title (optional)</Label>
                            <Input
                                value={(content.section_title as string) ?? ''}
                                onChange={(e) => onUpdateContent('section_title', e.target.value)}
                                placeholder="Optional title above HTML"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">HTML Content</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    {showPreview ? 'Edit' : 'Preview'}
                                </Button>
                            </div>
                            {showPreview ? (
                                <div
                                    className="p-3 border rounded-lg min-h-[120px] prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml((content.html_content as string) ?? '') }}
                                />
                            ) : (
                                <Textarea
                                    value={(content.html_content as string) ?? ''}
                                    onChange={(e) => onUpdateContent('html_content', e.target.value)}
                                    placeholder="<p>Your HTML content here</p>"
                                    rows={8}
                                    className="text-xs font-mono"
                                />
                            )}
                            <p className="text-xs text-muted-foreground">
                                HTML is sanitized for security. Allowed tags: p, br, strong, em, u, a, ul, ol, li, h1-h6, span, div, img.
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Layout &amp; Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <div className="space-y-1.5">
                            <Label className="text-xs">Vertical Padding</Label>
                            <Select
                                value={(styles.padding_y as string) || '4rem'}
                                onValueChange={(v) => onUpdateStyles('padding_y', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select padding" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2rem">Small (2rem)</SelectItem>
                                    <SelectItem value="4rem">Medium (4rem)</SelectItem>
                                    <SelectItem value="6rem">Large (6rem)</SelectItem>
                                    <SelectItem value="8rem">Extra Large (8rem)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max Width</Label>
                            <Select
                                value={(styles.max_width as string) || '1200px'}
                                onValueChange={(v) => onUpdateStyles('max_width', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select width" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="800px">Narrow (800px)</SelectItem>
                                    <SelectItem value="1000px">Medium (1000px)</SelectItem>
                                    <SelectItem value="1200px">Wide (1200px)</SelectItem>
                                    <SelectItem value="100%">Full Width</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

// ─── Responsive Settings (shared across all sections) ───────────────────────

function ResponsiveSettings({ section, onUpdateResponsive }: SectionEditorProps) {
    const responsive = section.responsive || {};

    return (
        <div className="space-y-3">
            {(['desktop', 'tablet', 'mobile'] as const).map((device) => {
                const DeviceIcon = device === 'desktop' ? Monitor : device === 'tablet' ? Tablet : Smartphone;
                const settings = responsive[device] || {};
                return (
                    <div key={device} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                            <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-medium capitalize">{device}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Hide on {device}</Label>
                            <Switch
                                checked={settings.hidden ?? false}
                                onCheckedChange={(v) => onUpdateResponsive(device, 'hidden', v)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Padding</Label>
                            <Select
                                value={settings.padding_y || 'default'}
                                onValueChange={(v) => onUpdateResponsive(device, 'padding_y', v === 'default' ? undefined : v)}
                            >
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    <SelectItem value="1rem">Compact (1rem)</SelectItem>
                                    <SelectItem value="2rem">Small (2rem)</SelectItem>
                                    <SelectItem value="4rem">Medium (4rem)</SelectItem>
                                    <SelectItem value="6rem">Large (6rem)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Section Editor Router ─────────────────────────────────────────────

export function SectionEditor(props: SectionEditorProps) {
    const { section } = props;

    const editorMap: Record<string, React.ComponentType<SectionEditorProps>> = {
        hero: HeroEditor,
        features: FeaturesEditor,
        product_grid: ProductGridEditor,
        testimonials: TestimonialsEditor,
        newsletter: NewsletterEditor,
        gallery: GalleryEditor,
        faq: FAQEditor,
        custom_html: CustomHTMLEditor,
    };

    const Editor = editorMap[section.type];

    if (!Editor) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                No editor available for section type: {section.type}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Editor {...props} />
            <Separator />
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="responsive">
                    <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-3.5 h-3.5" />
                            Responsive
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <ResponsiveSettings {...props} />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
