import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Info from "lucide-react/dist/esm/icons/info";
import { Badge } from '@/components/ui/badge';

export function CourierLoginInfo() {
  const { toast } = useToast();
  const courierLoginUrl = `${window.location.origin}/courier/login`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Login URL copied to clipboard',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle>Courier Login Portal</CardTitle>
        </div>
        <CardDescription>
          Share this URL with your couriers so they can log in to their delivery dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            value={courierLoginUrl} 
            readOnly 
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(courierLoginUrl)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(courierLoginUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-sm font-semibold">Login Requirements:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">1</Badge>
              Email and password (set by admin)
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">2</Badge>
              6-digit PIN (managed in PIN Management)
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">3</Badge>
              Active courier status
            </li>
          </ul>
        </div>

        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Couriers will only see orders from your business (tenant). 
            Their access is automatically isolated for security.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
