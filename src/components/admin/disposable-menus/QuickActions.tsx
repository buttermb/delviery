import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Plus from "lucide-react/dist/esm/icons/plus";
import FileDown from "lucide-react/dist/esm/icons/file-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Shield from "lucide-react/dist/esm/icons/shield";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

interface QuickActionsProps {
  onCreateMenu: () => void;
  onExportData?: () => void;
  onRefresh?: () => void;
  onViewSecurity?: () => void;
  isLoading?: boolean;
}

export const QuickActions = ({
  onCreateMenu,
  onExportData,
  onRefresh,
  onViewSecurity,
  isLoading
}: QuickActionsProps) => {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreateMenu}>
          <Plus className="h-4 w-4 mr-2" />
          Create Menu
        </Button>

        {onExportData && (
          <Button variant="outline" onClick={onExportData}>
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}

        {onRefresh && (
          <Button 
            variant="outline" 
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}

        {onViewSecurity && (
          <Button variant="outline" onClick={onViewSecurity}>
            <Shield className="h-4 w-4 mr-2" />
            Security
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Today's Views</div>
          <div className="text-xl font-bold">0</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Active Orders</div>
          <div className="text-xl font-bold">0</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Conversion</div>
          <div className="text-xl font-bold">0%</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Avg. Order</div>
          <div className="text-xl font-bold">$0</div>
        </div>
      </div>
    </Card>
  );
};
