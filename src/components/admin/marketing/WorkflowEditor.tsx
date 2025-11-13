import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Zap, Mail, MessageSquare, Clock, Loader2 } from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  status: "active" | "paused" | "draft";
}

interface WorkflowEditorProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WorkflowEditor({ open, onOpenChange }: WorkflowEditorProps) {
  const [workflows] = useState<Workflow[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // If used as a component (not dialog), render directly
  if (!open && !onOpenChange) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automated Workflows</CardTitle>
              <CardDescription>
                Set up automated email/SMS sequences
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)} className="min-h-[44px] touch-manipulation">
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workflows configured.</p>
              <p className="text-sm mt-2">
                Create workflows for welcome series, win-back campaigns, and reorder reminders.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{workflow.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Trigger: {workflow.trigger}
                    </div>
                  </div>
                  <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
                    {workflow.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Workflow Creation Dialog */}
          {isCreating && (
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Workflow</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Workflow builder coming soon.</p>
                    <p className="text-sm mt-2">
                      Configure triggers, conditions, and actions for automated campaigns.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      className="min-h-[44px] touch-manipulation"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    );
  }

  // If used as a dialog
  return (
    <Dialog open={open!} onOpenChange={onOpenChange!}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Workflow builder coming soon.</p>
            <p className="text-sm mt-2">
              Configure triggers, conditions, and actions for automated campaigns.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange!(false)}
              className="min-h-[44px] touch-manipulation"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

