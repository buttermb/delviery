/**
 * MenuTheme Component
 * Customize menu appearance per tenant. Includes colors, logo upload,
 * font selection, layout style, header image, footer text, custom CSS.
 * Real-time preview with save to menu record or tenant_branding.
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Type from 'lucide-react/dist/esm/icons/type';
import Layout from 'lucide-react/dist/esm/icons/layout';
import Image from 'lucide-react/dist/esm/icons/image';
import Code from 'lucide-react/dist/esm/icons/code';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Save from 'lucide-react/dist/esm/icons/save';
import Grid3x3 from 'lucide-react/dist/esm/icons/grid-3x3';
import List from 'lucide-react/dist/esm/icons/list';
import X from 'lucide-react/dist/esm/icons/x';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// ============================================
// Types
// ============================================

export interface MenuThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
    border: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: string;
  };
  layout: {
    style: 'grid' | 'list';
    columnsDesktop: number;
    columnsMobile: number;
    cardStyle: 'minimal' | 'bordered' | 'elevated';
    spacing: 'compact' | 'normal' | 'spacious';
  };
  branding: {
    logoUrl: string;
    headerImageUrl: string;
    footerText: string;
    showPoweredBy: boolean;
  };
  customCSS: string;
}

export const DEFAULT_MENU_THEME: MenuThemeConfig = {
  colors: {
    primary: '#22c55e',
    secondary: '#0f172a',
    background: '#ffffff',
    text: '#1e293b',
    accent: '#3b82f6',
    border: '#e2e8f0',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSize: '16px',
  },
  layout: {
    style: 'grid',
    columnsDesktop: 3,
    columnsMobile: 1,
    cardStyle: 'bordered',
    spacing: 'normal',
  },
  branding: {
    logoUrl: '',
    headerImageUrl: '',
    footerText: '',
    showPoweredBy: true,
  },
  customCSS: '',
};

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Outfit', value: 'Outfit' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Open Sans', value: 'Open Sans' },
] as const;

interface MenuThemeProps {
  menuId: string;
  className?: string;
  onThemeChange?: (theme: MenuThemeConfig) => void;
}

// ============================================
// Color Field Component
// ============================================

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
          className="flex-1 h-8 text-xs font-mono"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ============================================
// Image Upload Component
// ============================================

function ImageUploadField({
  label,
  value,
  onChange,
  tenantId,
  placeholder = 'Upload image',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  tenantId: string;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showErrorToast('File too large', 'Maximum file size is 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showErrorToast('Invalid file type', 'Please upload an image file');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/menu-theme/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('menu-assets')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      showSuccessToast('Image uploaded', 'Image has been uploaded successfully');
    } catch (error) {
      logger.error('Failed to upload image', error instanceof Error ? error : new Error(String(error)));
      showErrorToast('Upload failed', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        {value ? (
          <div className="relative w-16 h-16 rounded border overflow-hidden">
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <button
              onClick={() => onChange('')}
              className="absolute top-0 right-0 p-0.5 bg-destructive/80 rounded-bl"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ) : (
          <div className="w-16 h-16 rounded border border-dashed flex items-center justify-center bg-muted/50">
            <Image className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <Label
            htmlFor={`upload-${label.replace(/\s/g, '-')}`}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors',
              uploading && 'opacity-50 pointer-events-none'
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="text-sm">{uploading ? 'Uploading...' : placeholder}</span>
          </Label>
          <Input
            id={`upload-${label.replace(/\s/g, '-')}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Preview Component
// ============================================

function ThemePreview({ theme }: { theme: MenuThemeConfig }) {
  const previewStyle = {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.typography.bodyFont,
    fontSize: theme.typography.baseFontSize,
    borderColor: theme.colors.border,
  };

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={previewStyle}
    >
      {/* Header Preview */}
      {theme.branding.headerImageUrl && (
        <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${theme.branding.headerImageUrl})` }} />
      )}
      <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-3">
          {theme.branding.logoUrl && (
            <img src={theme.branding.logoUrl} alt="Logo" className="h-8 w-auto" />
          )}
          <h3
            className="font-bold text-lg"
            style={{ fontFamily: theme.typography.headingFont, color: theme.colors.secondary }}
          >
            Menu Preview
          </h3>
        </div>
      </div>

      {/* Products Preview */}
      <div className="p-4">
        <div
          className={cn(
            'gap-3',
            theme.layout.style === 'grid' ? `grid grid-cols-${theme.layout.columnsDesktop}` : 'space-y-3'
          )}
          style={{ display: theme.layout.style === 'grid' ? 'grid' : 'block', gridTemplateColumns: theme.layout.style === 'grid' ? `repeat(${theme.layout.columnsDesktop}, 1fr)` : undefined }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded p-3',
                theme.layout.cardStyle === 'bordered' && 'border',
                theme.layout.cardStyle === 'elevated' && 'shadow-md',
                theme.layout.style === 'list' && 'flex items-center gap-3'
              )}
              style={{
                borderColor: theme.colors.border,
                backgroundColor: theme.layout.cardStyle === 'elevated' ? theme.colors.background : undefined,
              }}
            >
              <div
                className={cn(
                  'rounded bg-muted',
                  theme.layout.style === 'grid' ? 'aspect-square mb-2' : 'w-16 h-16 flex-shrink-0'
                )}
              />
              <div className={theme.layout.style === 'list' ? 'flex-1' : ''}>
                <div
                  className="font-medium text-sm mb-1"
                  style={{ fontFamily: theme.typography.headingFont }}
                >
                  Product {i}
                </div>
                <div
                  className="text-xs opacity-70"
                  style={{ color: theme.colors.text }}
                >
                  Sample description
                </div>
                <div
                  className="font-bold text-sm mt-1"
                  style={{ color: theme.colors.primary }}
                >
                  $99.00
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Preview */}
      {(theme.branding.footerText || theme.branding.showPoweredBy) && (
        <div
          className="p-3 border-t text-center text-xs opacity-70"
          style={{ borderColor: theme.colors.border }}
        >
          {theme.branding.footerText && <p>{theme.branding.footerText}</p>}
          {theme.branding.showPoweredBy && <p className="mt-1">Powered by FloraIQ</p>}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function MenuTheme({ menuId, className, onThemeChange }: MenuThemeProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [theme, setTheme] = useState<MenuThemeConfig>(DEFAULT_MENU_THEME);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Fetch existing theme from menu record
  const { data: menuData, isLoading } = useQuery({
    queryKey: [...queryKeys.menus.detail(tenantId || '', menuId), 'theme'],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, appearance_settings')
        .eq('id', menuId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch menu theme', error);
        throw error;
      }

      return data;
    },
    enabled: !!tenantId && !!menuId,
  });

  // Load theme from menu data
  useEffect(() => {
    if (menuData?.appearance_settings) {
      const savedTheme = menuData.appearance_settings as unknown as MenuThemeConfig;
      // Merge with defaults to ensure all fields exist
      setTheme({
        ...DEFAULT_MENU_THEME,
        ...savedTheme,
        colors: { ...DEFAULT_MENU_THEME.colors, ...savedTheme.colors },
        typography: { ...DEFAULT_MENU_THEME.typography, ...savedTheme.typography },
        layout: { ...DEFAULT_MENU_THEME.layout, ...savedTheme.layout },
        branding: { ...DEFAULT_MENU_THEME.branding, ...savedTheme.branding },
      });
    }
  }, [menuData]);

  // Save theme mutation
  const saveThemeMutation = useMutation({
    mutationFn: async (themeConfig: MenuThemeConfig) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error } = await supabase
        .from('disposable_menus')
        .update({
          appearance_settings: themeConfig as unknown as Record<string, unknown> as any,
        })
        .eq('id', menuId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return themeConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.detail(tenantId || '', menuId) });
      showSuccessToast('Theme Saved', 'Menu theme has been saved successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save theme', { error, message });
      showErrorToast('Failed to Save', message);
    },
  });

  // Update handlers
  const updateColor = useCallback((key: keyof MenuThemeConfig['colors'], value: string) => {
    setTheme((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  }, []);

  const updateTypography = useCallback((key: keyof MenuThemeConfig['typography'], value: string) => {
    setTheme((prev) => ({
      ...prev,
      typography: { ...prev.typography, [key]: value },
    }));
  }, []);

  const updateLayout = useCallback(<K extends keyof MenuThemeConfig['layout']>(
    key: K,
    value: MenuThemeConfig['layout'][K]
  ) => {
    setTheme((prev) => ({
      ...prev,
      layout: { ...prev.layout, [key]: value },
    }));
  }, []);

  const updateBranding = useCallback(<K extends keyof MenuThemeConfig['branding']>(
    key: K,
    value: MenuThemeConfig['branding'][K]
  ) => {
    setTheme((prev) => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  }, []);

  const updateCustomCSS = useCallback((value: string) => {
    setTheme((prev) => ({ ...prev, customCSS: value }));
  }, []);

  const handleReset = useCallback(() => {
    setTheme(DEFAULT_MENU_THEME);
    logger.debug('Theme reset to defaults');
  }, []);

  const handleSave = useCallback(() => {
    saveThemeMutation.mutate(theme);
    onThemeChange?.(theme);
  }, [theme, saveThemeMutation, onThemeChange]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Menu Theme</h2>
            <p className="text-sm text-muted-foreground">
              Customize the appearance of your menu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveThemeMutation.isPending}>
            {saveThemeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Theme
          </Button>
        </div>
      </div>

      {/* Tabs for Edit/Preview */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="edit">
            <Palette className="h-4 w-4 mr-2" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Edit Tab */}
        <TabsContent value="edit" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Settings */}
            <div className="space-y-4">
              <Accordion type="multiple" defaultValue={['colors', 'typography', 'layout', 'branding']}>
                {/* Colors Section */}
                <AccordionItem value="colors">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      Colors
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ColorField label="Primary" value={theme.colors.primary} onChange={(v) => updateColor('primary', v)} />
                    <ColorField label="Secondary" value={theme.colors.secondary} onChange={(v) => updateColor('secondary', v)} />
                    <ColorField label="Background" value={theme.colors.background} onChange={(v) => updateColor('background', v)} />
                    <ColorField label="Text" value={theme.colors.text} onChange={(v) => updateColor('text', v)} />
                    <ColorField label="Accent" value={theme.colors.accent} onChange={(v) => updateColor('accent', v)} />
                    <ColorField label="Border" value={theme.colors.border} onChange={(v) => updateColor('border', v)} />
                  </AccordionContent>
                </AccordionItem>

                {/* Typography Section */}
                <AccordionItem value="typography">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-muted-foreground" />
                      Typography
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Heading Font</Label>
                      <Select value={theme.typography.headingFont} onValueChange={(v) => updateTypography('headingFont', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              <span style={{ fontFamily: font.value }}>{font.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Body Font</Label>
                      <Select value={theme.typography.bodyFont} onValueChange={(v) => updateTypography('bodyFont', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              <span style={{ fontFamily: font.value }}>{font.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base Font Size</Label>
                      <Select value={theme.typography.baseFontSize} onValueChange={(v) => updateTypography('baseFontSize', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="14px">14px (Small)</SelectItem>
                          <SelectItem value="15px">15px</SelectItem>
                          <SelectItem value="16px">16px (Default)</SelectItem>
                          <SelectItem value="17px">17px</SelectItem>
                          <SelectItem value="18px">18px (Large)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Layout Section */}
                <AccordionItem value="layout">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-muted-foreground" />
                      Layout
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    {/* Layout Style */}
                    <div className="space-y-2">
                      <Label className="text-xs">Display Style</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={theme.layout.style === 'grid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateLayout('style', 'grid')}
                          className="flex-1"
                        >
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          Grid
                        </Button>
                        <Button
                          type="button"
                          variant={theme.layout.style === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateLayout('style', 'list')}
                          className="flex-1"
                        >
                          <List className="h-4 w-4 mr-2" />
                          List
                        </Button>
                      </div>
                    </div>

                    {/* Columns (Grid only) */}
                    {theme.layout.style === 'grid' && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Desktop Columns</Label>
                          <Select
                            value={String(theme.layout.columnsDesktop)}
                            onValueChange={(v) => updateLayout('columnsDesktop', parseInt(v, 10))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 Columns</SelectItem>
                              <SelectItem value="3">3 Columns</SelectItem>
                              <SelectItem value="4">4 Columns</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Mobile Columns</Label>
                          <Select
                            value={String(theme.layout.columnsMobile)}
                            onValueChange={(v) => updateLayout('columnsMobile', parseInt(v, 10))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 Column</SelectItem>
                              <SelectItem value="2">2 Columns</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Card Style */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Card Style</Label>
                      <Select
                        value={theme.layout.cardStyle}
                        onValueChange={(v) => updateLayout('cardStyle', v as 'minimal' | 'bordered' | 'elevated')}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="bordered">Bordered</SelectItem>
                          <SelectItem value="elevated">Elevated (Shadow)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Spacing */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Spacing</Label>
                      <Select
                        value={theme.layout.spacing}
                        onValueChange={(v) => updateLayout('spacing', v as 'compact' | 'normal' | 'spacious')}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="spacious">Spacious</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Branding Section */}
                <AccordionItem value="branding">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-muted-foreground" />
                      Branding
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <ImageUploadField
                      label="Logo"
                      value={theme.branding.logoUrl}
                      onChange={(url) => updateBranding('logoUrl', url)}
                      tenantId={tenantId || ''}
                      placeholder="Upload logo"
                    />
                    <ImageUploadField
                      label="Header Image"
                      value={theme.branding.headerImageUrl}
                      onChange={(url) => updateBranding('headerImageUrl', url)}
                      tenantId={tenantId || ''}
                      placeholder="Upload header image"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Footer Text</Label>
                      <Textarea
                        value={theme.branding.footerText}
                        onChange={(e) => updateBranding('footerText', e.target.value)}
                        placeholder="Custom footer text..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Show "Powered by FloraIQ"</Label>
                      <Switch
                        checked={theme.branding.showPoweredBy}
                        onCheckedChange={(checked) => updateBranding('showPoweredBy', checked)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Custom CSS Section */}
                <AccordionItem value="css">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-muted-foreground" />
                      Custom CSS
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Add custom CSS rules to further customize your menu appearance.
                    </p>
                    <Textarea
                      value={theme.customCSS}
                      onChange={(e) => updateCustomCSS(e.target.value)}
                      placeholder={`.menu-product-card {\n  border-radius: 12px;\n}\n\n.menu-header {\n  background: linear-gradient(...);\n}`}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Right Column - Live Preview */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Live Preview
                  </CardTitle>
                  <CardDescription className="text-xs">
                    See how your menu will look to customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemePreview theme={theme} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Preview Tab (Full Width) */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Full Preview
              </CardTitle>
              <CardDescription>
                Full-size preview of your menu theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePreview theme={theme} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MenuTheme;
