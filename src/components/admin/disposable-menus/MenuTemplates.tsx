import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, Crown, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  expirationDays: number;
  burnAfterRead: boolean;
  maxViews: number | 'unlimited';
  accessType: 'invite_only' | 'shared' | 'hybrid';
  requireAccessCode: boolean;
  color: string;
  menuType?: 'product' | 'forum'; // New field to distinguish menu types
}

const TEMPLATES: MenuTemplate[] = [
  {
    id: 'weekly-special',
    name: 'Weekly Special',
    description: 'Perfect for weekly promotions and limited-time offers',
    icon: Clock,
    expirationDays: 7,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-blue-500',
    menuType: 'product',
  },
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    description: '24-hour flash sales with high urgency',
    icon: Zap,
    expirationDays: 1,
    burnAfterRead: false,
    maxViews: 100,
    accessType: 'shared',
    requireAccessCode: false,
    color: 'bg-orange-500',
    menuType: 'product',
  },
  {
    id: 'vip-menu',
    name: 'VIP Menu',
    description: 'Exclusive menu for premium customers',
    icon: Crown,
    expirationDays: 30,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-purple-500',
    menuType: 'product',
  },
  {
    id: 'forum-menu',
    name: 'Forum Menu',
    description: 'Create a menu that links to the community forum',
    icon: MessageSquare,
    expirationDays: 90,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'shared',
    requireAccessCode: false,
    color: 'bg-green-500',
    menuType: 'forum',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Start from scratch with all options',
    icon: Sparkles,
    expirationDays: 30,
    burnAfterRead: false,
    maxViews: 'unlimited',
    accessType: 'invite_only',
    requireAccessCode: true,
    color: 'bg-gray-500',
    menuType: 'product',
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
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expiration:</span>
                  <span className="font-medium">
                    {template.expirationDays === 1 
                      ? '24 hours' 
                      : template.expirationDays === 7
                      ? '7 days'
                      : template.expirationDays === 30
                      ? '30 days'
                      : template.expirationDays === 90
                      ? '90 days'
                      : 'Custom'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Access:</span>
                  <Badge variant="outline" className="text-xs">
                    {template.accessType.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max Views:</span>
                  <span className="font-medium">
                    {template.maxViews === 'unlimited' ? '∞' : template.maxViews}
                  </span>
                </div>
                {template.requireAccessCode && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Badge variant="secondary" className="text-xs">
                      Access Code Required
                    </Badge>
                  </div>
                )}
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

