import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Lock from "lucide-react/dist/esm/icons/lock";
import Plus from "lucide-react/dist/esm/icons/plus";
import FileText from "lucide-react/dist/esm/icons/file-text";

interface EmptyStateProps {
  onCreateMenu: () => void;
}

export const EmptyState = ({ onCreateMenu }: EmptyStateProps) => {
  return (
    <Card className="p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        
        <h3 className="text-xl font-bold mb-2">No Disposable Menus Yet</h3>
        <p className="text-muted-foreground mb-6">
          Create encrypted, self-destructing catalogs with advanced security features for your wholesale customers.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onCreateMenu} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Menu
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="/DISPOSABLE_MENUS_README.md" target="_blank">
              <FileText className="h-4 w-4 mr-2" />
              View Documentation
            </a>
          </Button>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-3 gap-4 mt-8 text-left">
          <div className="space-y-2">
            <div className="font-semibold text-sm">🔐 Encrypted Links</div>
            <p className="text-xs text-muted-foreground">
              Cryptographically secure URLs with access codes
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-sm">📍 Geofencing</div>
            <p className="text-xs text-muted-foreground">
              Location-based access restrictions
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-sm">🔥 Self-Destruct</div>
            <p className="text-xs text-muted-foreground">
              Soft or hard burn capabilities
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
