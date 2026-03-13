/**
 * MenuCustomBranding Component
 * Task 285: Add menu custom branding section
 *
 * Allows customization of menu appearance with branding options
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Image from 'lucide-react/dist/esm/icons/image';
import Type from 'lucide-react/dist/esm/icons/type';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Upload from 'lucide-react/dist/esm/icons/upload';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';

export interface MenuBrandingSettings {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl?: string;
  headerImageUrl?: string;
  fontFamily: string;
  customCss?: string;
}

interface MenuCustomBrandingProps {
  settings: MenuBrandingSettings;
  onChange: (settings: MenuBrandingSettings) => void;
  onLogoUpload?: (file: File) => Promise<string>;
  onHeaderImageUpload?: (file: File) => Promise<string>;
  className?: string;
}

const COLOR_PRESETS = [
  { name: 'Emerald', primary: '#16a34a', accent: '#10b981', bg: '#ffffff', text: '#1f2937' },
  { name: 'Purple', primary: '#9333ea', accent: '#a855f7', bg: '#ffffff', text: '#1f2937' },
  { name: 'Blue', primary: '#2563eb', accent: '#3b82f6', bg: '#ffffff', text: '#1f2937' },
  { name: 'Orange', primary: '#ea580c', accent: '#f97316', bg: '#ffffff', text: '#1f2937' },
  { name: 'Dark', primary: '#0f172a', accent: '#1e293b', bg: '#0f172a', text: '#f8fafc' },
];

const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Space Grotesk',
];

export function MenuCustomBranding({
  settings,
  onChange,
  onLogoUpload,
  onHeaderImageUpload,
  className,
}: MenuCustomBrandingProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const handleColorChange = (key: keyof MenuBrandingSettings, value: string) => {
    onChange({ ...settings, [key]: value });
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    onChange({
      ...settings,
      primaryColor: preset.primary,
      accentColor: preset.accent,
      backgroundColor: preset.bg,
      textColor: preset.text,
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onLogoUpload) return;

    setUploadingLogo(true);
    try {
      const url = await onLogoUpload(file);
      onChange({ ...settings, logoUrl: url });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleHeaderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onHeaderImageUpload) return;

    setUploadingHeader(true);
    try {
      const url = await onHeaderImageUpload(file);
      onChange({ ...settings, headerImageUrl: url });
    } finally {
      setUploadingHeader(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Custom Branding</CardTitle>
        </div>
        <CardDescription>
          Customize the look and feel of your menu to match your brand
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="colors" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="colors">
              <Palette className="h-4 w-4 mr-2" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="images">
              <Image className="h-4 w-4 mr-2" />
              Images
            </TabsTrigger>
            <TabsTrigger value="typography">
              <Type className="h-4 w-4 mr-2" />
              Typography
            </TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-4">
            {/* Color Presets */}
            <div>
              <Label className="text-sm mb-2 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="h-auto py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <span className="text-xs">{preset.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor" className="text-sm mb-2 block">
                  Primary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    className="flex-1"
                    placeholder="#16a34a"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="accentColor" className="text-sm mb-2 block">
                  Accent Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="accentColor"
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                    className="flex-1"
                    placeholder="#10b981"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="backgroundColor" className="text-sm mb-2 block">
                  Background Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings.backgroundColor}
                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                    className="flex-1"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="textColor" className="text-sm mb-2 block">
                  Text Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="textColor"
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings.textColor}
                    onChange={(e) => handleColorChange('textColor', e.target.value)}
                    className="flex-1"
                    placeholder="#1f2937"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Logo</Label>
              <div className="space-y-2">
                {settings.logoUrl && (
                  <div className="border rounded p-2 flex items-center justify-center bg-muted">
                    <img
                      src={settings.logoUrl}
                      alt="Logo preview"
                      className="max-h-24 object-contain"
                    />
                  </div>
                )}
                <Button variant="outline" className="w-full" disabled={uploadingLogo}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? 'Uploading...' : settings.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploadingLogo}
                  />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Header Image</Label>
              <div className="space-y-2">
                {settings.headerImageUrl && (
                  <div className="border rounded overflow-hidden">
                    <img
                      src={settings.headerImageUrl}
                      alt="Header preview"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <Button variant="outline" className="w-full" disabled={uploadingHeader}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingHeader ? 'Uploading...' : settings.headerImageUrl ? 'Replace Header' : 'Upload Header'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHeaderUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploadingHeader}
                  />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Typography Tab */}
          <TabsContent value="typography" className="space-y-4">
            <div>
              <Label htmlFor="fontFamily" className="text-sm mb-2 block">
                Font Family
              </Label>
              <select
                id="fontFamily"
                value={settings.fontFamily}
                onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                className="w-full p-2 border rounded-md bg-background"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="customCss" className="text-sm mb-2 block">
                Custom CSS (Advanced)
              </Label>
              <Textarea
                id="customCss"
                value={settings.customCss ?? ''}
                onChange={(e) => onChange({ ...settings, customCss: e.target.value })}
                placeholder=".menu-header { border-radius: 8px; }"
                className="font-mono text-xs"
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Add custom CSS to further customize your menu appearance
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        <div>
          <Label className="text-sm mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Label>
          <Card
            className="overflow-hidden"
            style={{
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
            }}
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-12 object-contain" />
                )}
                <h3
                  className="text-2xl font-bold"
                  style={{
                    color: settings.primaryColor,
                    fontFamily: settings.fontFamily,
                  }}
                >
                  Your Menu Name
                </h3>
                <p className="text-sm" style={{ fontFamily: settings.fontFamily }}>
                  This is how your menu will appear to customers
                </p>
                <Badge
                  style={{
                    backgroundColor: settings.accentColor,
                    color: settings.backgroundColor,
                  }}
                >
                  $25.00
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
