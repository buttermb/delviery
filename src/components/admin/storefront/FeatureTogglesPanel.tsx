/**
 * FeatureTogglesPanel Component
 * Card-based toggle controls for storefront features
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Tag from "lucide-react/dist/esm/icons/tag";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Leaf from "lucide-react/dist/esm/icons/leaf";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Search from "lucide-react/dist/esm/icons/search";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import Star from "lucide-react/dist/esm/icons/star";
import Layout from "lucide-react/dist/esm/icons/layout";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Mail from "lucide-react/dist/esm/icons/mail";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import Image from "lucide-react/dist/esm/icons/image";
import { type FeatureToggles } from '@/lib/storefrontPresets';

interface FeatureTogglesPanelProps {
    featureToggles: FeatureToggles;
    onUpdateToggle: (key: keyof FeatureToggles, value: boolean) => void;
}

interface ToggleItem {
    key: keyof FeatureToggles;
    label: string;
    description: string;
    icon: React.ElementType;
}

const BADGE_TOGGLES: ToggleItem[] = [
    {
        key: 'showSaleBadges',
        label: 'Sale Badges',
        description: 'Show red "Sale" badge on discounted products',
        icon: Tag,
    },
    {
        key: 'showNewBadges',
        label: 'New Badges',
        description: 'Show "New" badge on recent products',
        icon: Sparkles,
    },
    {
        key: 'showStrainBadges',
        label: 'Strain Type',
        description: 'Show Indica/Sativa/Hybrid badges',
        icon: Leaf,
    },
    {
        key: 'showStockWarnings',
        label: 'Low Stock Alerts',
        description: 'Warn customers when items are running low',
        icon: AlertTriangle,
    },
];

const GRID_TOGGLES: ToggleItem[] = [
    {
        key: 'enableSearch',
        label: 'Search Bar',
        description: 'Let customers search your products',
        icon: Search,
    },
    {
        key: 'showCategories',
        label: 'Category Tabs',
        description: 'Show category filter tabs above products',
        icon: LayoutGrid,
    },
    {
        key: 'showPremiumFilter',
        label: 'Premium Filter',
        description: 'Add filter for premium/top-shelf items',
        icon: Star,
    },
];

const SECTION_TOGGLES: ToggleItem[] = [
    {
        key: 'showHero',
        label: 'Hero Banner',
        description: 'Large banner at the top of the page',
        icon: Image,
    },
    {
        key: 'showFeatures',
        label: 'Features Grid',
        description: 'Value props like "Fast Delivery", "Lab Tested"',
        icon: Layout,
    },
    {
        key: 'showTestimonials',
        label: 'Testimonials',
        description: 'Customer reviews and quotes',
        icon: MessageSquare,
    },
    {
        key: 'showNewsletter',
        label: 'Newsletter',
        description: 'Email signup form at the bottom',
        icon: Mail,
    },
    {
        key: 'showFAQ',
        label: 'FAQ Section',
        description: 'Frequently asked questions accordion',
        icon: HelpCircle,
    },
];

export function FeatureTogglesPanel({
    featureToggles,
    onUpdateToggle,
}: FeatureTogglesPanelProps) {
    return (
        <div className="space-y-8">
            {/* Product Badges */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Tag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Product Badges</CardTitle>
                            <CardDescription className="text-sm">
                                Control what badges appear on product cards
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {BADGE_TOGGLES.map(toggle => (
                            <ToggleCard
                                key={toggle.key}
                                toggle={toggle}
                                checked={featureToggles[toggle.key]}
                                onCheckedChange={(checked) => onUpdateToggle(toggle.key, checked)}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Grid Features */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Product Grid</CardTitle>
                            <CardDescription className="text-sm">
                                Search and filter options for your product catalog
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {GRID_TOGGLES.map(toggle => (
                            <ToggleCard
                                key={toggle.key}
                                toggle={toggle}
                                checked={featureToggles[toggle.key]}
                                onCheckedChange={(checked) => onUpdateToggle(toggle.key, checked)}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Page Sections */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Layout className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Page Sections</CardTitle>
                            <CardDescription className="text-sm">
                                Toggle which sections appear on your storefront
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {SECTION_TOGGLES.map(toggle => (
                            <ToggleCard
                                key={toggle.key}
                                toggle={toggle}
                                checked={featureToggles[toggle.key]}
                                onCheckedChange={(checked) => onUpdateToggle(toggle.key, checked)}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface ToggleCardProps {
    toggle: ToggleItem;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

function ToggleCard({ toggle, checked, onCheckedChange }: ToggleCardProps) {
    const Icon = toggle.icon;

    return (
        <div
            className={`
                flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                ${checked
                    ? 'bg-primary/5 border-primary/30 shadow-sm'
                    : 'bg-muted/20 border-transparent hover:border-muted-foreground/20 hover:bg-muted/40'}
            `}
            onClick={() => onCheckedChange(!checked)}
        >
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${checked ? 'bg-primary/15' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${checked ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <Label className="text-sm font-semibold cursor-pointer block" htmlFor={toggle.key}>
                        {toggle.label}
                    </Label>
                    <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                        {toggle.description}
                    </p>
                </div>
            </div>
            <Switch
                id={toggle.key}
                checked={checked}
                onCheckedChange={onCheckedChange}
                className="shrink-0 ml-4"
            />
        </div>
    );
}

/**
 * Compact version for smaller spaces
 */
export function FeatureTogglesCompact({
    featureToggles,
    onUpdateToggle,
}: FeatureTogglesPanelProps) {
    const allToggles = [...BADGE_TOGGLES, ...GRID_TOGGLES, ...SECTION_TOGGLES];

    return (
        <div className="space-y-2">
            {allToggles.map(toggle => {
                const Icon = toggle.icon;
                return (
                    <div
                        key={toggle.key}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                        <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{toggle.label}</span>
                        </div>
                        <Switch
                            checked={featureToggles[toggle.key]}
                            onCheckedChange={(checked) => onUpdateToggle(toggle.key, checked)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
