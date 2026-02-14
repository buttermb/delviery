/**
 * Coming Soon Page
 * Shows a professional "under construction" page for missing features
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Construction, ArrowLeft, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ComingSoonPageProps {
  pageName?: string;
  estimatedDate?: string;
  description?: string;
}

export default function ComingSoonPage({
  pageName = 'This Feature',
  estimatedDate,
  description
}: ComingSoonPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const notifyMe = () => {
    toast({
      title: 'Notification set!',
      description: `We'll notify you when ${pageName} is ready.`,
    });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-12 pb-12 text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Construction className="h-10 w-10 text-primary" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{pageName}</h1>
            <p className="text-muted-foreground">
              This feature is under construction
            </p>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {description}
            </p>
          )}

          {/* Estimated Date */}
          {estimatedDate && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full">
              <span className="text-sm font-medium">
                Expected launch: {estimatedDate}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={notifyMe}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Notify Me
            </Button>
          </div>

          {/* Progress */}
          <div className="pt-6">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              Development in progress
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

