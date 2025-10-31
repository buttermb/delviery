import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ["Cmd/Ctrl", "K"], description: "Open Global Search" },
  { keys: ["Cmd/Ctrl", "Shift", "D"], description: "Dashboard" },
  { keys: ["Cmd/Ctrl", "Shift", "O"], description: "Orders" },
  { keys: ["Cmd/Ctrl", "Shift", "P"], description: "Products" },
  { keys: ["Cmd/Ctrl", "Shift", "U"], description: "Users" },
  { keys: ["Cmd/Ctrl", "Shift", "C"], description: "Couriers" },
  { keys: ["Cmd/Ctrl", "Shift", "M"], description: "Live Map" },
  { keys: ["Cmd/Ctrl", "Shift", "L"], description: "Live Orders" },
  { keys: ["Cmd/Ctrl", "Shift", "A"], description: "Analytics" },
  { keys: ["Cmd/Ctrl", "Shift", "S"], description: "Settings" },
  { keys: ["?"], description: "Show this dialog" },
];

export function AdminKeyboardShortcutsDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of keyboard shortcuts available in the admin panel
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <div key={keyIndex} className="flex items-center gap-1">
                    {keyIndex > 0 && <span className="text-muted-foreground">+</span>}
                    <kbd className="px-2 py-1 text-xs font-semibold bg-background border rounded shadow-sm">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border rounded">?</kbd> anywhere in the admin panel to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
