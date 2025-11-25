import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useIntegrationManager } from '@/hooks/useIntegrationManager';
import { getAllFeatures, ESSENTIAL_FEATURES } from '@/lib/sidebar/featureRegistry';
import { getHiddenFeaturesByIntegrations } from '@/lib/sidebar/integrations';
import { CheckCircle, Info, Layers } from 'lucide-react';

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
    const { connectionStatuses, getIntegrationsWithStatus } = useIntegrationManager();
    const allFeatures = getAllFeatures();
    const integrations = getIntegrationsWithStatus();

    // Calculate stats
    const totalFeatures = allFeatures.length;
    const visibleFeatures = sidebarConfig.reduce((acc, section) => acc + section.items.length, 0);
    const hiddenCount = totalFeatures - visibleFeatures;
    
    // Determine base config source
    const currentLayoutPreset = preferences?.layoutPreset || 'default';
    const baseConfigSource = currentLayoutPreset !== 'default' 
      ? 'Enterprise (overridden by preset)' 
      : `${operationSize.charAt(0).toUpperCase() + operationSize.slice(1)} Operation`;
    
    // Calculate filtering stages
    const enabledIntegrations = preferences?.enabledIntegrations || ['mapbox', 'stripe'];
    const integrationHiddenFeatures = getHiddenFeaturesByIntegrations(enabledIntegrations);
    const featuresAfterIntegrationFilter = totalFeatures - integrationHiddenFeatures.length;

    return (
        <div className="space-y-6">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                    <strong>Base Config Source:</strong> {baseConfigSource}
                    {currentLayoutPreset !== 'default' && (
                        <span className="block mt-1 text-xs">
                            Preset "{currentLayoutPreset}" uses enterprise config to access all {totalFeatures} features
                        </span>
                    )}
                </AlertDescription>
            </Alert>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Feature Filtering Pipeline
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                            <span>1. Base Config ({baseConfigSource})</span>
                            <Badge>{totalFeatures} features</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                            <span>2. After Integration Filter</span>
                            <Badge>{featuresAfterIntegrationFilter} features</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                            <span>3. After Preset/Tier Filter</span>
                            <Badge>{visibleFeatures} features</Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-primary/10 rounded font-medium">
                            <span>Final Sidebar</span>
                            <Badge variant="default">{visibleFeatures} visible</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
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
                                {businessTier || 'street'}
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
                    <CardTitle>Integration Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {integrations.map(integration => {
                            const isEnabled = integration.enabled;
                            const isConnected = connectionStatuses[integration.id] ?? false;
                            const affectedFeatures = integration.featuresEnabled.length;

                            return (
                                <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <integration.icon className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{integration.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {affectedFeatures} features • {integration.featuresEnabled.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEnabled ? (
                                            <Badge variant={isConnected ? 'default' : 'secondary'}>
                                                {isConnected ? 'Connected' : 'Enabled'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">Disabled</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

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

                                const isEssential = ESSENTIAL_FEATURES.includes(feature.id);

                                // Check if hidden by integration using the single source of truth
                                const enabledIntegrations = preferences?.enabledIntegrations || ['mapbox', 'stripe'];
                                const integrationHiddenFeatures = getHiddenFeaturesByIntegrations(enabledIntegrations);
                                const isHiddenByIntegration = integrationHiddenFeatures.includes(feature.id);

                                // Find which integration is responsible
                                const hidingIntegration = integrations.find(int => 
                                    !int.enabled && int.featuresEnabled.includes(feature.id)
                                );

                                return (
                                    <div key={feature.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-3">
                                            <feature.icon className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-sm">{feature.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ID: {feature.id} • Min Tier: {feature.minBusinessTier}
                                                    {isEssential && ' • Essential'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isVisible ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    <CheckCircle className="h-3 w-3 mr-1" /> Visible
                                                </Badge>
                                            ) : (
                                                <div className="flex gap-1 flex-wrap justify-end">
                                                    {isHiddenByTier && <Badge variant="secondary">Tier: {feature.minBusinessTier}</Badge>}
                                                    {isHiddenByUser && <Badge variant="secondary">User Hidden</Badge>}
                                                    {isHiddenByIntegration && hidingIntegration && (
                                                        <Badge variant="secondary">{hidingIntegration.name} Disabled</Badge>
                                                    )}
                                                    {!isHiddenByTier && !isHiddenByUser && !isHiddenByIntegration && (
                                                        <Badge variant="outline">Unknown</Badge>
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
