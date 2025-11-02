/**
 * Feature List Component
 * Display list of features
 */

import { Badge } from '@/components/ui/badge';

interface FeatureListProps {
  features: Record<string, boolean>;
}

export function FeatureList({ features }: FeatureListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(features).map(([key, enabled]) => (
        <Badge key={key} variant={enabled ? 'default' : 'secondary'}>
          {key.replace(/_/g, ' ')}
        </Badge>
      ))}
    </div>
  );
}
