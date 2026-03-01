import { useState } from "react";
import { Plus, Star, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoiceTemplates, InvoiceTemplate, InvoiceTemplateData } from "@/hooks/useInvoiceTemplates";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from "@/lib/utils";

interface InvoiceTemplateEditorProps {
  onClose?: () => void;
}

export function InvoiceTemplateEditor({ onClose }: InvoiceTemplateEditorProps) {
  const { templates, createTemplate, updateTemplate, setDefaultTemplate, deleteTemplate } = useInvoiceTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id || null);
  const [editData, setEditData] = useState<Partial<InvoiceTemplate> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleSelect = (template: InvoiceTemplate) => {
    setSelectedId(template.id);
    setEditData({
      name: template.name,
      description: template.description,
      template_data: { ...template.template_data }
    });
  };

  const handleSave = async () => {
    if (!selectedId || !editData) return;

    if (selectedId.startsWith("default-")) {
      // Create new template from default
      await createTemplate.mutateAsync({
        name: editData.name || "New Template",
        description: editData.description || null,
        template_data: editData.template_data as InvoiceTemplateData,
        is_default: false,
        is_system: false
      });
    } else {
      await updateTemplate.mutateAsync({
        id: selectedId,
        ...editData
      });
    }
  };

  const handleCreateNew = async () => {
    const newTemplate = await createTemplate.mutateAsync({
      name: "New Template",
      description: "Custom invoice template",
      template_data: {
        colors: { primary: "#10b981", secondary: "#6b7280", accent: "#3b82f6" },
        layout: { logoPosition: "left", showFooter: true, compactMode: false },
        content: { footerText: "Thank you for your business!", paymentInstructions: "" }
      },
      is_default: false,
      is_system: false
    });
    if (newTemplate) {
      setSelectedId(newTemplate.id);
      handleSelect(newTemplate);
    }
  };

  const updateTemplateData = (path: string, value: unknown) => {
    if (!editData?.template_data) return;

    const newData = { ...editData.template_data };
    const keys = path.split(".");
    let obj: Record<string, unknown> = newData as Record<string, unknown>;
    
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]] as Record<string, unknown>;
    }
    obj[keys[keys.length - 1]] = value;
    
    setEditData({ ...editData, template_data: newData });
  };

  return (
    <div className="space-y-4">
      {/* Template List */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "cursor-pointer min-w-[140px] transition-all",
              selectedId === template.id && "ring-2 ring-primary"
            )}
            onClick={() => handleSelect(template)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: template.template_data.colors.primary }}
                />
                <span className="font-medium text-sm truncate">{template.name}</span>
              </div>
              <div className="flex gap-1">
                {template.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                {template.is_system && <Badge variant="outline" className="text-xs">System</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card
          className="cursor-pointer min-w-[100px] border-dashed hover:border-primary transition-colors"
          onClick={handleCreateNew}
        >
          <CardContent className="p-3 flex items-center justify-center h-full">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Editor */}
      {selectedTemplate && editData && (
        <Tabs defaultValue="colors" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editData.template_data?.colors.primary || "#10b981"}
                    onChange={(e) => updateTemplateData("colors.primary", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={editData.template_data?.colors.primary || "#10b981"}
                    onChange={(e) => updateTemplateData("colors.primary", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editData.template_data?.colors.secondary || "#6b7280"}
                    onChange={(e) => updateTemplateData("colors.secondary", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={editData.template_data?.colors.secondary || "#6b7280"}
                    onChange={(e) => updateTemplateData("colors.secondary", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editData.template_data?.colors.accent || "#3b82f6"}
                    onChange={(e) => updateTemplateData("colors.accent", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={editData.template_data?.colors.accent || "#3b82f6"}
                    onChange={(e) => updateTemplateData("colors.accent", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Logo Position</Label>
                <Select
                  value={editData.template_data?.layout.logoPosition || "left"}
                  onValueChange={(v) => updateTemplateData("layout.logoPosition", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Footer</Label>
                <Switch
                  checked={editData.template_data?.layout.showFooter ?? true}
                  onCheckedChange={(v) => updateTemplateData("layout.showFooter", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Compact Mode</Label>
                <Switch
                  checked={editData.template_data?.layout.compactMode ?? false}
                  onCheckedChange={(v) => updateTemplateData("layout.compactMode", v)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={editData.name || ""}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                disabled={selectedTemplate.is_system}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Textarea
                value={editData.template_data?.content.footerText || ""}
                onChange={(e) => updateTemplateData("content.footerText", e.target.value)}
                placeholder="Thank you for your business!"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Instructions</Label>
              <Textarea
                value={editData.template_data?.content.paymentInstructions || ""}
                onChange={(e) => updateTemplateData("content.paymentInstructions", e.target.value)}
                placeholder="Optional payment instructions..."
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <div className="flex gap-2">
          {selectedTemplate && !selectedTemplate.is_default && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedId && setDefaultTemplate.mutate(selectedId)}
              disabled={setDefaultTemplate.isPending}
            >
              {setDefaultTemplate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Star className="h-4 w-4 mr-1" />}
              Set Default
            </Button>
          )}
          {selectedTemplate && !selectedTemplate.is_system && !selectedId?.startsWith("default-") && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateTemplate.isPending}>
            {updateTemplate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (selectedId) {
            deleteTemplate.mutate(selectedId);
            setDeleteDialogOpen(false);
          }
        }}
        itemType="template"
        isLoading={deleteTemplate.isPending}
      />
    </div>
  );
}
