/**
 * Storefront Closed State Component
 * Displays when store is closed or unavailable
 */

import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface BusinessHours {
  monday?: string | null;
  tuesday?: string | null;
  wednesday?: string | null;
  thursday?: string | null;
  friday?: string | null;
  saturday?: string | null;
  sunday?: string | null;
}

interface StorefrontClosedStateProps {
  storeName: string;
  reason?: 'closed' | 'maintenance' | 'suspended' | 'scheduled';
  message?: string | null;
  reopensAt?: string | null;
  businessHours?: BusinessHours | null;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export default function StorefrontClosedState({
  storeName,
  reason = 'closed',
  message,
  reopensAt,
  businessHours,
}: StorefrontClosedStateProps) {
  const getReasonBadge = () => {
    switch (reason) {
      case 'maintenance':
        return (
          <Badge variant="secondary" className="gap-2">
            <AlertCircle className="h-3 w-3" />
            Under Maintenance
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="destructive" className="gap-2">
            <AlertCircle className="h-3 w-3" />
            Temporarily Unavailable
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="secondary" className="gap-2">
            <Clock className="h-3 w-3" />
            Closed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-2">
            <Clock className="h-3 w-3" />
            Currently Closed
          </Badge>
        );
    }
  };

  const getHeading = () => {
    switch (reason) {
      case 'maintenance':
        return "We'll Be Right Back";
      case 'suspended':
        return 'Store Temporarily Unavailable';
      case 'scheduled':
        return "We're Closed Right Now";
      default:
        return 'Store Closed';
    }
  };

  const getDefaultMessage = () => {
    switch (reason) {
      case 'maintenance':
        return "We're performing scheduled maintenance to improve your experience. Please check back soon!";
      case 'suspended':
        return 'This store is temporarily unavailable. Please contact support for more information.';
      case 'scheduled':
        return "Thanks for visiting! We're currently closed but will reopen during our business hours.";
      default:
        return "We're currently closed. Please check our business hours below.";
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <div className="flex justify-center">{getReasonBadge()}</div>
          <h1 className="text-3xl md:text-4xl font-bold">{getHeading()}</h1>
          <p className="text-lg text-muted-foreground">{storeName}</p>
        </div>

        {/* Message */}
        <Alert>
          <AlertDescription className="text-center">
            {message || getDefaultMessage()}
          </AlertDescription>
        </Alert>

        {/* Reopens At */}
        {reopensAt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center text-center">
                <Calendar className="h-5 w-5" />
                Reopening Soon
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-primary">
                {format(new Date(reopensAt), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-muted-foreground mt-1">
                at {format(new Date(reopensAt), 'h:mm a')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Business Hours */}
        {businessHours && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center text-center">
                <Clock className="h-5 w-5" />
                Business Hours
              </CardTitle>
              <CardDescription className="text-center">
                Visit us during these times
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const hours = businessHours[day];
                  return (
                    <div
                      key={day}
                      className="flex justify-between items-center py-2 border-b last:border-0"
                    >
                      <span className="font-medium capitalize">{day}</span>
                      <span className="text-muted-foreground">
                        {hours || 'Closed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground">
          Need immediate assistance? Please contact us directly.
        </p>
      </div>
    </div>
  );
}
