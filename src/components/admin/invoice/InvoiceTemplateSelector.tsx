import { useState } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import Palette from "lucide-react/dist/esm/icons/palette";
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useInvoiceTemplates, InvoiceTemplate } from "@/hooks/useInvoiceTemplates";
import { InvoiceTemplateEditor } from "./InvoiceTemplateEditor";

interface InvoiceTemplateSelectorProps {
  value?: string;
  onChange: (templateId: string, template: InvoiceTemplate) => void;
}

export function InvoiceTemplateSelector({ value, onChange }: InvoiceTemplateSelectorProps) {
  const { templates, defaultTemplate, isLoading } = useInvoiceTemplates();
  const [editorOpen, setEditorOpen] = useState(false);

  const selectedTemplate = templates.find(t => t.id === value) || defaultTemplate;

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedTemplate?.id}
        onValueChange={(id) => {
          const template = templates.find(t => t.id === id);
          if (template) onChange(id, template);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedTemplate?.template_data.colors.primary }}
            />
            <SelectValue placeholder="Select template" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: template.template_data.colors.primary }}
                />
                <span>{template.name}</span>
                {template.is_default && (
                  <Badge variant="secondary" className="text-xs ml-1">Default</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Invoice Templates</DialogTitle>
          </DialogHeader>
          <InvoiceTemplateEditor onClose={() => setEditorOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
