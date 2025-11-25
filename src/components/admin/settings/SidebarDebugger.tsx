import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { getAllFeatures } from '@/lib/sidebar/featureRegistry';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export function SidebarDebugger() {
    const {
        sidebarConfig,
        operationSize,
        detectedSize,
        isAutoDetected,
        businessTier,
        businessPreset
    } = useSidebarConfig();

    const { preferences } = useSidebarPreferences();
    const allFeatures = getAllFeatures();

    // Calculate stats
    const totalFeatures = allFeatures.length;
    const visibleFeatures = sidebarConfig.reduce((acc, section) => acc + section.items.length, 0);
    const hiddenCount = totalFeatures - visibleFeatures;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Operation Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold capitalize">{operationSize}</span>
                            {isAutoDetected ? (
                                <Badge variant="secondary">Auto</Badge>
                            ) : (
                                <Badge>Manual</Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Detected: <span className="capitalize">{detectedSize}</span>
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Business Tier</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold capitalize">{businessTier}</span>
                            <Badge variant={businessTier === 'empire' ? 'default' : 'outline'}>
                                {businessPreset?.name || 'Unknown'}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {businessPreset?.enabledFeatures.includes('all') ? 'All Features Unlocked' : 'Restricted Mode'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Active Preset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold capitalize">
                                {preferences?.layoutPreset || 'Default'}
                            </span>
                            <Badge variant="outline">Layout</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Integrations: {preferences?.enabledIntegrations?.join(', ') || 'None'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Feature Visibility Audit</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                        <div className="space-y-4">
                            {allFeatures.map(feature => {
                                // Check visibility
                                const isVisible = sidebarConfig.some(s => s.items.some(i => i.id === feature.id));

                                // Check why it might be hidden
                                const isHiddenByTier = businessPreset &&
                                    !businessPreset.enabledFeatures.includes('all') &&
                                    !businessPreset.enabledFeatures.includes(feature.id);

                                const isHiddenByUser = preferences?.hiddenFeatures?.includes(feature.id);

                                const isHiddenByIntegration = !['dashboard', 'settings', 'billing'].includes(feature.id) &&
                                    (
                                        (feature.id.includes('stripe') && !preferences?.enabledIntegrations?.includes('stripe')) ||
                                        (feature.id.includes('mapbox') && !preferences?.enabledIntegrations?.includes('mapbox'))
                                    );

                                return (
                                    <div key={feature.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-3">
                                            <feature.icon className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-sm">{feature.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ID: {feature.id} • Min Tier: {feature.minBusinessTier}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isVisible ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    <CheckCircle className="h-3 w-3 mr-1" /> Visible
                                                </Badge>
                                            ) : (
                                                <div className="flex gap-1">
                                                    {isHiddenByTier && <Badge variant="secondary">Tier Locked</Badge>}
                                                    {isHiddenByUser && <Badge variant="secondary">User Hidden</Badge>}
                                                    {isHiddenByIntegration && <Badge variant="secondary">Integration Missing</Badge>}
                                                    {!isHiddenByTier && !isHiddenByUser && !isHiddenByIntegration && (
                                                        <Badge variant="destructive">Unknown Hidden</Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
