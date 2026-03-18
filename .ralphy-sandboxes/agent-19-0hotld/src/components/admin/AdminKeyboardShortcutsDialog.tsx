import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation - Hub Structure
  { keys: ["Cmd/Ctrl", "K"], description: "Open Global Search", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "1"], description: "Go to Home Dashboard", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "2"], description: "Go to Orders Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "3"], description: "Go to Inventory Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "4"], description: "Go to Customers Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "5"], description: "Go to Finance Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "6"], description: "Go to Fulfillment Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "7"], description: "Go to Marketing Hub", category: "Navigation" },
  { keys: ["Cmd/Ctrl", "8"], description: "Go to Analytics Hub", category: "Navigation" },
  
  // Quick Actions
  { keys: ["N"], description: "New Order / Product / Customer", category: "Quick Actions" },
  { keys: ["Cmd/Ctrl", "S"], description: "Save Changes", category: "Quick Actions" },
  { keys: ["Cmd/Ctrl", "P"], description: "Print / Export", category: "Quick Actions" },
  { keys: ["R"], description: "Refresh Data", category: "Quick Actions" },
  
  // General
  { keys: ["?"], description: "Show Keyboard Shortcuts", category: "General" },
  { keys: ["Esc"], description: "Close Dialog / Cancel", category: "General" },
  { keys: ["/"], description: "Focus Search", category: "General" },
  { keys: ["Cmd/Ctrl", "B"], description: "Toggle Sidebar", category: "General" },
];

export function AdminKeyboardShortcutsDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <div key={keyIndex} className="flex items-center gap-1">
                            {keyIndex > 0 && <span className="text-muted-foreground text-xs">+</span>}
                            <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                              {key}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press <Badge variant="outline" className="mx-1 font-mono text-xs">?</Badge> anywhere in the admin panel to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
