import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Eye, Lock, Shield } from 'lucide-react';

interface SecuritySettingsBadgesProps {
  settings: any;
  compact?: boolean;
}

export const SecuritySettingsBadges = ({ settings, compact = false }: SecuritySettingsBadgesProps) => {
  if (!settings) return null;

  const badges = [];

  if (settings.require_geofence) {
    badges.push({
      icon: MapPin,
      label: compact ? 'Geo' : 'Geofencing',
      tooltip: `${settings.geofence_radius}km radius`
    });
  }

  if (settings.time_restrictions) {
    badges.push({
      icon: Clock,
      label: compact ? 'Time' : 'Time Restricted',
      tooltip: `${settings.allowed_hours?.start || 0}:00 - ${settings.allowed_hours?.end || 24}:00`
    });
  }

  if (settings.max_views) {
    badges.push({
      icon: Eye,
      label: compact ? `${settings.max_views}x` : `Max ${settings.max_views} views`,
      tooltip: 'View limit enforced'
    });
  }

  if (settings.require_whitelist || settings.invite_only) {
    badges.push({
      icon: Lock,
      label: compact ? 'Invite' : 'Invite Only',
      tooltip: 'Whitelist required'
    });
  }

  if (settings.single_use) {
    badges.push({
      icon: Shield,
      label: compact ? '1x' : 'Single Use',
      tooltip: 'One-time access'
    });
  }

  if (badges.length === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Basic Security
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, i) => {
        const Icon = badge.icon;
        return (
          <Badge 
            key={i} 
            variant="secondary" 
            className="text-xs"
            title={badge.tooltip}
          >
            <Icon className="h-3 w-3 mr-1" />
            {badge.label}
          </Badge>
        );
      })}
    </div>
  );
};
