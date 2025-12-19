import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Eye, Lock } from 'lucide-react';

interface ViewLimitExceededProps {
  viewLimit: number;
  menuName?: string;
  contactInfo?: string;
}

export const ViewLimitExceeded = ({
  viewLimit,
  menuName = 'this catalog',
  contactInfo
}: ViewLimitExceededProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Eye className="h-16 w-16 text-muted-foreground" />
            <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-1">
              <Lock className="h-5 w-5 text-destructive-foreground" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-3">View Limit Reached</h1>
        
        <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <p>You've reached your view limit for {menuName}</p>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-2">Maximum views allowed:</p>
          <p className="text-3xl font-bold text-primary">{viewLimit}</p>
        </div>

        <div className="space-y-3 text-sm text-left bg-accent/50 rounded-lg p-4 mb-6">
          <p className="font-medium">What this means:</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>This is a security measure to prevent unauthorized sharing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Each customer has a limited number of views per period</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Your access will be reset in the next period</span>
            </li>
          </ul>
        </div>

        {contactInfo && (
          <div className="border-t pt-6 mt-6">
            <p className="text-sm text-muted-foreground mb-3">
              Need immediate access?
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href={`tel:${contactInfo}`}>
                Contact Supplier
              </a>
            </Button>
          </div>
        )}

        {!contactInfo && (
          <div className="border-t pt-6 mt-6">
            <p className="text-sm text-muted-foreground">
              Please contact your supplier to request additional views
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
