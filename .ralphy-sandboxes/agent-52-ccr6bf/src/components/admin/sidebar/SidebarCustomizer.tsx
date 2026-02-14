/**
 * Sidebar Customizer Component
 * 
 * Main UI for customizing sidebar layout, features, and integrations
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureVisibilityManager } from './FeatureVisibilityManager';
import { IntegrationManager } from './IntegrationManager';
import { LayoutPresets } from './LayoutPresets';
import { SidebarDebugger } from '@/components/admin/settings/SidebarDebugger';
import { Settings, Eye, Plug, Layout, Bug } from 'lucide-react';

export function SidebarCustomizer() {
  const [activeTab, setActiveTab] = useState('visibility');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Sidebar Customization</CardTitle>
        </div>
        <CardDescription>
          Customize your sidebar layout, hide/show features, and manage integrations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid ${import.meta.env.DEV ? 'grid-cols-4' : 'grid-cols-3'} mb-6`}>
            <TabsTrigger value="visibility" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Visibility</span>
              <span className="sm:hidden">Show</span>
            </TabsTrigger>
            <TabsTrigger value="presets" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              <span className="hidden sm:inline">Presets</span>
              <span className="sm:hidden">Presets</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
              <span className="sm:hidden">Apps</span>
            </TabsTrigger>
            {/* Debug tab only visible in development */}
            {import.meta.env.DEV && (
              <TabsTrigger value="debug" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                <span className="hidden sm:inline">Debug</span>
                <span className="sm:hidden">Debug</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="visibility" className="space-y-4">
            <FeatureVisibilityManager />
          </TabsContent>

          <TabsContent value="presets" className="space-y-4">
            <LayoutPresets />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <IntegrationManager />
          </TabsContent>

          {/* Debug content only visible in development */}
          {import.meta.env.DEV && (
            <TabsContent value="debug" className="space-y-4">
              <SidebarDebugger />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
