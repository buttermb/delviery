import { useState } from "react";
import { FileText, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InvoiceNotesEditorProps {
  notes?: string;
  terms?: string;
  onSave?: (notes: string, terms: string) => void;
  isSaving?: boolean;
}

/**
 * Task 303: Invoice Notes and Terms Editor
 * Editable notes and payment terms for invoices
 */
export function InvoiceNotesEditor({ notes = "", terms = "", onSave, isSaving }: InvoiceNotesEditorProps) {
  const [localNotes, setLocalNotes] = useState(notes);
  const [localTerms, setLocalTerms] = useState(terms);

  const hasChanges = localNotes !== notes || localTerms !== terms;

  const handleSave = () => {
    if (onSave) {
      onSave(localNotes, localTerms);
    }
  };

  const defaultTerms = `Payment Terms:
• Payment is due within the specified timeframe
• Late payments may incur additional fees
• All amounts are in USD unless otherwise stated
• Please include invoice number with payment

Questions? Contact us for assistance.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Notes & Terms
        </CardTitle>
        <CardDescription>Add notes and payment terms to this invoice</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notes">Internal Notes</TabsTrigger>
            <TabsTrigger value="terms">Payment Terms</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Add internal notes visible only to your team"
                rows={6}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">{localNotes.length}/1000 characters</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Internal notes are for reference only and won't appear on the customer-facing invoice.
            </p>
          </TabsContent>

          <TabsContent value="terms" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="terms">Payment Terms</Label>
              <Textarea
                id="terms"
                value={localTerms}
                onChange={(e) => setLocalTerms(e.target.value)}
                placeholder={defaultTerms}
                rows={8}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">{localTerms.length}/2000 characters</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Payment terms will be displayed at the bottom of the invoice PDF.
            </p>
          </TabsContent>
        </Tabs>

        {hasChanges && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalNotes(notes);
                setLocalTerms(terms);
              }}
            >
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : <><Save className="h-3 w-3 mr-1" /> Save</>}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
