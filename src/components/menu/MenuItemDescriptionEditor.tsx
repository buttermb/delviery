/**
 * MenuItemDescriptionEditor Component
 * Task 288: Create menu item description editor
 *
 * Rich text editor for menu item descriptions with formatting options
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Type from 'lucide-react/dist/esm/icons/type';
import Bold from 'lucide-react/dist/esm/icons/bold';
import Italic from 'lucide-react/dist/esm/icons/italic';
import List from 'lucide-react/dist/esm/icons/list';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Save from 'lucide-react/dist/esm/icons/save';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
}

interface MenuItemDescriptionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItem;
  onSave: (itemId: string, description: string) => Promise<void>;
  isSaving?: boolean;
}

const DESCRIPTION_TEMPLATES = [
  {
    name: 'Simple',
    template: 'A premium product crafted with care.',
  },
  {
    name: 'Detailed',
    template:
      'Experience the exceptional quality of this carefully selected product. Known for its distinct characteristics and superior craftsmanship.',
  },
  {
    name: 'Effects Focused',
    template:
      'Perfect for relaxation and unwinding. This product offers a balanced experience with smooth onset and lasting effects.',
  },
  {
    name: 'Flavor Profile',
    template:
      'Rich flavors with notes of earth and pine. A complex aroma that delights the senses with every use.',
  },
];

const FORMATTING_HELPERS = [
  { symbol: '**text**', label: 'Bold', icon: Bold },
  { symbol: '*text*', label: 'Italic', icon: Italic },
  { symbol: '• item\n• item', label: 'Bullet List', icon: List },
];

export function MenuItemDescriptionEditor({
  open,
  onOpenChange,
  item,
  onSave,
  isSaving = false,
}: MenuItemDescriptionEditorProps) {
  const [description, setDescription] = useState(item.description ?? '');
  const [charCount, setCharCount] = useState(item.description?.length ?? 0);
  const maxChars = 500;

  const handleDescriptionChange = (value: string) => {
    if (value.length <= maxChars) {
      setDescription(value);
      setCharCount(value.length);
    }
  };

  const handleSave = async () => {
    await onSave(item.id, description.trim());
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDescription(item.description ?? '');
    setCharCount(item.description?.length ?? 0);
    onOpenChange(false);
  };

  const applyTemplate = (template: string) => {
    setDescription(template);
    setCharCount(template.length);
  };

  const insertFormatting = (symbol: string) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.substring(start, end);
    const beforeText = description.substring(0, start);
    const afterText = description.substring(end);

    let newText = '';
    if (symbol === '**text**') {
      newText = `${beforeText}**${selectedText || 'text'}**${afterText}`;
    } else if (symbol === '*text*') {
      newText = `${beforeText}*${selectedText || 'text'}*${afterText}`;
    } else if (symbol === '• item\n• item') {
      newText = `${beforeText}\n• ${selectedText || 'item'}\n• item${afterText}`;
    }

    handleDescriptionChange(newText);
  };

  // Simple markdown preview
  const renderPreview = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('• ')) {
          return `<li key="${i}">${line.substring(2)}</li>`;
        }
        return `<p key="${i}">${line}</p>`;
      })
      .join('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Edit Description
          </DialogTitle>
          <DialogDescription>
            Edit the description for <strong>{item.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="edit" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Edit Tab */}
          <TabsContent value="edit" className="flex-1 space-y-4">
            {/* Templates */}
            <div>
              <Label className="text-sm mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Quick Templates
              </Label>
              <div className="flex flex-wrap gap-2">
                {DESCRIPTION_TEMPLATES.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template.template)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Formatting Helpers */}
            <div>
              <Label className="text-sm mb-2 block">Formatting</Label>
              <div className="flex gap-2">
                {FORMATTING_HELPERS.map((helper) => {
                  const Icon = helper.icon;
                  return (
                    <Button
                      key={helper.label}
                      variant="outline"
                      size="sm"
                      onClick={() => insertFormatting(helper.symbol)}
                      title={helper.label}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                **bold** *italic* • bullet lists
              </p>
            </div>

            {/* Description Editor */}
            <div>
              <Label htmlFor="description" className="text-sm mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Enter a compelling description for this menu item..."
                className="min-h-[200px] resize-none"
                maxLength={maxChars}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  Use formatting: **bold**, *italic*, • bullets
                </p>
                <Badge
                  variant={charCount > maxChars * 0.9 ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {charCount}/{maxChars}
                </Badge>
              </div>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">{item.name}</h3>
                  <p className="text-lg font-semibold text-primary">
                    ${item.price.toFixed(2)}
                  </p>
                  {description ? (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: renderPreview(description) }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">No description</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Description
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
