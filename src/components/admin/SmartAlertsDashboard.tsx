import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Package, Users, Clock } from "lucide-react";
import { format } from "date-fns";

interface Alert {
  id: string;
  type: 'stock' | 'payment' | 'delivery' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  actionable: boolean;
}

interface SmartAlertsDashboardProps {
  alerts: Alert[];
  onDismiss?: (alertId: string) => void;
  onTakeAction?: (alertId: string) => void;
}

export function SmartAlertsDashboard({
  alerts,
  onDismiss,
  onTakeAction
}: SmartAlertsDashboardProps) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'stock':
        return <Package className="h-4 w-4" />;
      case 'payment':
        return <TrendingUp className="h-4 w-4" />;
      case 'delivery':
        return <Clock className="h-4 w-4" />;
      case 'performance':
        return <Users className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = alerts.filter(a => a.severity === 'high').length;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Smart Alerts
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {alerts.length} active alerts
              {criticalAlerts > 0 && ` · ${criticalAlerts} critical`}
              {highAlerts > 0 && ` · ${highAlerts} high priority`}
            </p>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">✨</div>
              <div className="font-medium">All clear!</div>
              <div className="text-sm">No alerts at this time</div>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{alert.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </div>
                      </div>
                      <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(alert.timestamp), 'MMM dd, yyyy h:mm a')}
                      </div>
                      <div className="flex gap-2">
                        {alert.actionable && onTakeAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onTakeAction(alert.id)}
                          >
                            Take Action
                          </Button>
                        )}
                        {onDismiss && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDismiss(alert.id)}
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
