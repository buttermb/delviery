import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRealtimeViewerCount } from '@/hooks/useRealtimeViewerCount';

export function RealtimeViewerBadge({ tenantId }: { tenantId: string | undefined }) {
  const realtimeViewerCount = useRealtimeViewerCount(tenantId);
  if (realtimeViewerCount <= 0) return null;
  return (
    <Badge variant="outline" className="animate-pulse border-green-500 text-green-600 gap-1">
      <Activity className="h-3 w-3" />
      {realtimeViewerCount} live
    </Badge>
  );
}
