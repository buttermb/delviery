import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Bug, Zap, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: "feature" | "improvement" | "bugfix" | "breaking";
    description: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-03-13",
    changes: [
      { type: "feature", description: "Added admin activity feed widget" },
      { type: "feature", description: "Implemented quick actions toolbar" },
      { type: "improvement", description: "Enhanced keyboard shortcuts dialog" },
      { type: "bugfix", description: "Fixed offline detection banner positioning" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-01",
    changes: [
      { type: "feature", description: "Added onboarding wizard for new tenants" },
      { type: "feature", description: "Implemented onboarding checklist widget" },
      { type: "improvement", description: "Enhanced dashboard tour experience" },
      { type: "bugfix", description: "Fixed error boundary recovery state" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-15",
    changes: [
      { type: "feature", description: "Initial release of FloraIQ" },
      { type: "feature", description: "Core inventory management" },
      { type: "feature", description: "Customer relationship tools" },
      { type: "feature", description: "Disposable menu system" },
    ],
  },
];

const changeTypeConfig = {
  feature: {
    icon: Sparkles,
    label: "New",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  improvement: {
    icon: Zap,
    label: "Improved",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  bugfix: {
    icon: Bug,
    label: "Fixed",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  breaking: {
    icon: Package,
    label: "Breaking",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    CHANGELOG[0]?.version ?? null
  );

  const selectedEntry = CHANGELOG.find((entry) => entry.version === selectedVersion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">What's New</DialogTitle>
              <DialogDescription>
                Stay updated with the latest features and improvements
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(600px-100px)]">
          {/* Sidebar - Version List */}
          <div className="w-48 border-r bg-muted/30">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {CHANGELOG.map((entry) => (
                  <button
                    key={entry.version}
                    onClick={() => setSelectedVersion(entry.version)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedVersion === entry.version
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="font-medium">v{entry.version}</div>
                    <div
                      className={cn(
                        "text-xs",
                        selectedVersion === entry.version
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content - Changes */}
          <div className="flex-1">
            <ScrollArea className="h-full">
              {selectedEntry ? (
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">
                      Version {selectedEntry.version}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Released on{" "}
                      {new Date(selectedEntry.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {selectedEntry.changes.map((change, index) => {
                      const config = changeTypeConfig[change.type];
                      const Icon = config.icon;

                      return (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              config.className
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className={cn("text-xs", config.className)}
                              >
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-sm">{change.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  Select a version to view changes
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
