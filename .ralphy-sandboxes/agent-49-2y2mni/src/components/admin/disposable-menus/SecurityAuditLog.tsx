import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Search,
  AlertTriangle,
  Eye,
  MapPin,
  Camera,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SecurityEvent {
  id?: string;
  event_type: string;
  severity?: string;
  created_at?: string | number;
  details?: {
    customer_name?: string;
    method?: string;
    reason?: string;
    location?: string | { latitude: number; longitude: number };
  } | null;
  [key: string]: unknown;
}

interface SecurityAuditLogProps {
  events: SecurityEvent[];
  onRefresh: () => void;
}

export const SecurityAuditLog = ({ events, onRefresh }: SecurityAuditLogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.details?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || event.severity === severityFilter;
    const matchesType = typeFilter === 'all' || event.event_type === typeFilter;
    
    return matchesSearch && matchesSeverity && matchesType;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'screenshot_attempt': return <Camera className="h-4 w-4" />;
      case 'geofence_violation': return <MapPin className="h-4 w-4" />;
      case 'failed_access': return <Lock className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Security Audit Log</h3>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="screenshot_attempt">Screenshots</SelectItem>
            <SelectItem value="geofence_violation">Geofence</SelectItem>
            <SelectItem value="failed_access">Failed Access</SelectItem>
            <SelectItem value="suspicious_activity">Suspicious</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No security events found</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <Card key={event.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-muted rounded-lg">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.details?.customer_name || 'Unknown user'}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {event.details?.method && (
                        <p>Method: {event.details.method}</p>
                      )}
                      {event.details?.reason && (
                        <p>Reason: {event.details.reason}</p>
                      )}
                      {event.details?.location && typeof event.details.location === 'object' && 'latitude' in event.details.location && (
                        <p>Location: {event.details.location.latitude}, {event.details.location.longitude}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {format(new Date(event.created_at), 'MMM dd, yyyy')}
                  <br />
                  {format(new Date(event.created_at), 'HH:mm:ss')}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </Card>
  );
};
