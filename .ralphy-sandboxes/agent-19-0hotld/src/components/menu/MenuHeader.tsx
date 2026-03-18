import { Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface MenuHeaderProps {
  title: string;
  description: string | null;
  expiresAt: string | null;
  customerName?: string;
}

export function MenuHeader({ title, description, expiresAt, customerName }: MenuHeaderProps) {
  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiresDate ? expiresDate < new Date() : false;

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
      <div className="container mx-auto px-4 py-8">
        <Card className="border-none bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {customerName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Welcome, {customerName}</span>
                </div>
              )}

              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  {title}
                </h1>
                {description && (
                  <p className="text-muted-foreground text-lg">
                    {description}
                  </p>
                )}
              </div>

              {expiresDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                    {isExpired ? (
                      'This menu has expired'
                    ) : (
                      <>
                        Expires {formatDistanceToNow(expiresDate, { addSuffix: true })}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
