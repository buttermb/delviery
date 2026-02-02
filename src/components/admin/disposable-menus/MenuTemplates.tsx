import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Clock from "lucide-react/dist/esm/icons/clock";
import Zap from "lucide-react/dist/esm/icons/zap";
import Crown from "lucide-react/dist/esm/icons/crown";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { cn } from '@/lib/utils';

interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  expirationDays: number;
  burnAfterRead: boolean;
  maxViews: number | 'unlimited';
  accessType: 'invite_only' | 'shared' | 'hybrid';
  requireAccessCode: boolean;
  color: string;
  menuType?: 'product' | 'forum';
  // OPSEC settings
  security_settings: {
    screenshot_protection_enabled: boolean;
    watermark_enabled: boolean;
    require_geofence: boolean;
    device_fingerprinting: boolean;
  };
}

const TEMPLATES: MenuTemplate[] = [
  {
    id: 'delivery-menu',
    name: 'Delivery Menu',
    description: 'Secure menu for delivery orders with burn protection',
    tagline: '24hr burn • Screenshot protected',
    icon: Clock,
    expirationDays: 1,
    burnAfterRead: true,
    maxViews: 'unlimited',
    accessType: 'shared',
    requireAccessCode: true,
    color: 'bg-emerald-500',
    menuType: 'product',
    security_settings: {
      screenshot_protection_enabled: true,
      watermark_enabled: true,
      require_geofence: false,
      device_fingerprinting: true,
    },
  },
  {
    id: 'popup-event',
    name: 'Pop-Up Event',
    description: 'Location-locked menu for events and pop-ups',
    tagline: 'Geofenced • Time-limited',
    icon: Zap,
    expirationDays: 1,
    burnAfterRead: false,
    maxViews: 100,
    accessType: 'shared',
    requireAccessCode: false,
    color: 'bg-amber-500',
    menuType: 'product',
    security_settings: {
      screenshot_protection_enabled: true,
      watermark_enabled: false,
      require_geofence: true,
      device_fingerprinting: true,
    },
  },
  {
    id: 'wholesale-drop',
    name: 'Wholesale Drop',
    description: 'Invite-only menu for B2B buyers with view limits',
    tagline: 'Invite only • 50 views max',
    icon: Crown,
    expirationDays: 7,
    burnAfterRead: false,
    maxViews: 50,
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-violet-500',
    menuType: 'product',
    security_settings: {
      screenshot_protection_enabled: true,
      watermark_enabled: true,
      require_geofence: false,
      device_fingerprinting: true,
    },
  },
  {
    id: 'member-club',
    name: 'Member Club',
    description: 'VIP menu for loyal customers with extended access',
    tagline: 'Code protected • 30-day access',
    icon: Sparkles,
    expirationDays: 30,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-pink-500',
    menuType: 'product',
    security_settings: {
      screenshot_protection_enabled: false,
      watermark_enabled: true,
      require_geofence: false,
      device_fingerprinting: false,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Start from scratch with full control',
    tagline: 'All options available',
    icon: MessageSquare,
    expirationDays: 7,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-slate-500',
    menuType: 'product',
    security_settings: {
      screenshot_protection_enabled: true,
      watermark_enabled: true,
      require_geofence: false,
      device_fingerprinting: true,
    },
  },
];

interface MenuTemplatesProps {
  onSelectTemplate: (template: MenuTemplate) => void;
  selectedTemplateId?: string;
}

export const MenuTemplates = ({ onSelectTemplate, selectedTemplateId }: MenuTemplatesProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {TEMPLATES.map((template) => {
        const Icon = template.icon;
        const isSelected = selectedTemplateId === template.id;

        return (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              isSelected && 'ring-2 ring-primary'
            )}
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', template.color, 'bg-opacity-10')}>
                    <Icon className={cn('h-5 w-5', template.color.replace('bg-', 'text-'))} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                {isSelected && (
                  <Badge variant="default">Selected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Tagline */}
              <p className="text-xs font-medium text-muted-foreground mb-3">
                {template.tagline}
              </p>

              {/* Security Features */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {template.security_settings.screenshot_protection_enabled && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    📸 Screenshot Protection
                  </Badge>
                )}
                {template.security_settings.require_geofence && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    📍 Geofenced
                  </Badge>
                )}
                {template.burnAfterRead && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    🔥 Auto-Burn
                  </Badge>
                )}
                {template.security_settings.device_fingerprinting && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    🔒 Device Lock
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium">
                    {template.expirationDays === 1
                      ? '24 hours'
                      : template.expirationDays === 7
                        ? '7 days'
                        : template.expirationDays === 30
                          ? '30 days'
                          : `${template.expirationDays} days`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Views:</span>
                  <span className="font-medium">
                    {template.maxViews === 'unlimited' ? 'Unlimited' : `${template.maxViews} max`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export type { MenuTemplate };
export { TEMPLATES };

