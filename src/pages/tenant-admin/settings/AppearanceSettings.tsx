import { useState, useEffect } from 'react';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Layout,
  Sidebar,
  Maximize,
  Minimize,
  Eye,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { SidebarCustomizer } from '@/components/admin/sidebar/SidebarCustomizer';

type Theme = 'light' | 'dark' | 'system';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark mode' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Match your device settings' },
];

export default function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>('system');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Apply theme changes
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }

    toast({ title: 'Theme updated' });
  }, [theme]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Appearance</h2>
        <p className="text-muted-foreground mt-1">
          Customize the look and feel of your dashboard
        </p>
      </div>

      {/* Theme Selection */}
      <SettingsSection
        title="Theme"
        description="Choose your preferred color scheme"
        icon={Palette}
      >
        <SettingsCard>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
            className="grid grid-cols-3 gap-4"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    theme === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                  <div
                    className={cn(
                      'h-12 w-12 rounded-full flex items-center justify-center',
                      theme === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>

          {/* Preview */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm font-medium mb-4">Preview</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white border shadow-sm dark:hidden">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200" />
                  <div className="space-y-1">
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-2 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-20 bg-slate-50 rounded" />
              </div>
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 shadow-sm hidden dark:block">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full bg-slate-700" />
                  <div className="space-y-1">
                    <div className="h-3 w-24 bg-slate-700 rounded" />
                    <div className="h-2 w-16 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="h-20 bg-slate-800 rounded" />
              </div>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Sidebar Settings */}
      <SettingsSection
        title="Sidebar"
        description="Configure sidebar behavior and appearance"
        icon={Sidebar}
      >
        <SettingsCard>
          <SettingsRow
            label="Default Collapsed"
            description="Start with the sidebar minimized"
          >
            <Switch
              checked={sidebarCollapsed}
              onCheckedChange={setSidebarCollapsed}
            />
          </SettingsRow>

          <div className="pt-4 border-t space-y-4">
            <p className="text-sm font-medium">Operation Size</p>
            <OperationSizeSelector />
          </div>
        </SettingsCard>

        <div className="mt-4">
          <SidebarCustomizer />
        </div>
      </SettingsSection>

      {/* Display Options */}
      <SettingsSection
        title="Display"
        description="Adjust layout and visual preferences"
        icon={Layout}
      >
        <SettingsCard>
          <SettingsRow
            label="Compact Mode"
            description="Reduce spacing and padding throughout the interface"
          >
            <div className="flex items-center gap-3">
              {compactMode ? (
                <Minimize className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Maximize className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={compactMode}
                onCheckedChange={(checked) => {
                  setCompactMode(checked);
                  toast({ title: checked ? 'Compact mode enabled' : 'Compact mode disabled' });
                }}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label="Animations"
            description="Enable smooth transitions and animations"
          >
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={animationsEnabled}
                onCheckedChange={(checked) => {
                  setAnimationsEnabled(checked);
                  if (!checked) {
                    document.documentElement.classList.add('no-animations');
                  } else {
                    document.documentElement.classList.remove('no-animations');
                  }
                  toast({ title: checked ? 'Animations enabled' : 'Animations disabled' });
                }}
              />
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* Reset */}
      <SettingsCard className="border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Reset to Defaults</p>
            <p className="text-sm text-muted-foreground">
              Restore all appearance settings to their original values
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setTheme('system');
              setSidebarCollapsed(false);
              setCompactMode(false);
              setAnimationsEnabled(true);
              toast({ title: 'Settings reset to defaults' });
            }}
          >
            Reset All
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

