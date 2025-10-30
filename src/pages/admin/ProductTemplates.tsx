import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  defaults: any;
  created_at: string;
}

export default function ProductTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("flower");
  const [templateDefaults, setTemplateDefaults] = useState("{}");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Note: You'd need to create a product_templates table
  // For now, storing in localStorage as example
  const templates: Template[] = JSON.parse(
    localStorage.getItem("product_templates") || "[]"
  );

  const saveTemplate = () => {
    try {
      const newTemplate: Template = {
        id: editingTemplate?.id || crypto.randomUUID(),
        name: templateName,
        category: templateCategory,
        description: "",
        defaults: JSON.parse(templateDefaults),
        created_at: new Date().toISOString(),
      };

      const existing = templates.filter((t) => t.id !== editingTemplate?.id);
      localStorage.setItem(
        "product_templates",
        JSON.stringify([...existing, newTemplate])
      );

      toast({ title: "Template saved successfully" });
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check template defaults format",
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = (id: string) => {
    const filtered = templates.filter((t) => t.id !== id);
    localStorage.setItem("product_templates", JSON.stringify(filtered));
    toast({ title: "Template deleted" });
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const useTemplate = (template: Template) => {
    localStorage.setItem("new_product_template", JSON.stringify(template.defaults));
    navigate("/admin/products/new");
    toast({ title: "Template loaded - starting new product" });
  };

  const resetForm = () => {
    setTemplateName("");
    setTemplateCategory("flower");
    setTemplateDefaults("{}");
    setEditingTemplate(null);
  };

  const predefinedTemplates = [
    {
      name: "Flower Template",
      category: "flower",
      defaults: {
        category: "flower",
        effects: ["Relaxing", "Euphoric"],
        consumption_methods: ["Smoking", "Vaporizing"],
      },
    },
    {
      name: "Pre-Roll Template",
      category: "pre-rolls",
      defaults: {
        category: "pre-rolls",
        effects: ["Uplifting", "Social"],
        consumption_methods: ["Smoking"],
      },
    },
    {
      name: "Edible Template",
      category: "edibles",
      defaults: {
        category: "edibles",
        effects: ["Relaxing", "Sleepy"],
        consumption_methods: ["Oral"],
      },
    },
    {
      name: "Vape Template",
      category: "vapes",
      defaults: {
        category: "vapes",
        effects: ["Energizing", "Focused"],
        consumption_methods: ["Vaporizing"],
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Templates</h1>
          <p className="text-muted-foreground">
            Save time with pre-configured product templates
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Predefined Templates */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Standard Templates</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {predefinedTemplates.map((template) => (
            <Card key={template.name} className="p-4">
              <h3 className="font-semibold mb-2">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 capitalize">
                {template.category}
              </p>
              <Button
                onClick={() => useTemplate(template as Template)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Use Template
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      {templates.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Custom Templates</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{template.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {template.category}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTemplate(template);
                        setTemplateName(template.name);
                        setTemplateCategory(template.category);
                        setTemplateDefaults(JSON.stringify(template.defaults, null, 2));
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this template?")) {
                          deleteTemplate(template.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() => useTemplate(template)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Use Template
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Premium Flower Template"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="w-full mt-1.5 border rounded-md p-2"
              >
                <option value="flower">Flower</option>
                <option value="pre-rolls">Pre-Rolls</option>
                <option value="edibles">Edibles</option>
                <option value="vapes">Vapes</option>
                <option value="concentrates">Concentrates</option>
              </select>
            </div>

            <div>
              <Label htmlFor="defaults">Template Defaults (JSON)</Label>
              <Textarea
                id="defaults"
                value={templateDefaults}
                onChange={(e) => setTemplateDefaults(e.target.value)}
                placeholder='{"effects": ["Relaxing"], "price": 45}'
                rows={10}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                JSON format with default values for new products
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={saveTemplate} className="flex-1">
                {editingTemplate ? "Update" : "Create"} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
