import { useState } from "react";
import { Hash, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InvoiceSequenceConfigProps {
  prefix?: string;
  nextNumber?: number;
  format?: "YYYY-NNNN" | "INV-NNNN" | "NNNN";
  onSave?: (config: { prefix: string; nextNumber: number; format: string }) => void;
  isSaving?: boolean;
}

/**
 * Task 309: Invoice Sequence Numbering per Tenant
 * Configure invoice numbering format and sequence
 */
export function InvoiceSequenceConfig({
  prefix = "INV",
  nextNumber = 1001,
  format = "INV-NNNN",
  onSave,
  isSaving,
}: InvoiceSequenceConfigProps) {
  const [localPrefix, setLocalPrefix] = useState(prefix);
  const [localNextNumber, setLocalNextNumber] = useState(nextNumber.toString());
  const [localFormat, setLocalFormat] = useState(format);

  const hasChanges =
    localPrefix !== prefix ||
    localNextNumber !== nextNumber.toString() ||
    localFormat !== format;

  const handleSave = () => {
    if (onSave) {
      onSave({
        prefix: localPrefix,
        nextNumber: parseInt(localNextNumber, 10),
        format: localFormat,
      });
    }
  };

  const getPreview = () => {
    const num = parseInt(localNextNumber, 10) || 1;
    const year = new Date().getFullYear();

    switch (localFormat) {
      case "YYYY-NNNN":
        return `${year}-${num.toString().padStart(4, "0")}`;
      case "INV-NNNN":
        return `${localPrefix}-${num.toString().padStart(4, "0")}`;
      case "NNNN":
        return num.toString().padStart(4, "0");
      default:
        return `${localPrefix}-${num}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-4 w-4" />
          Invoice Numbering
        </CardTitle>
        <CardDescription>Configure invoice number format and sequence</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="format">Number Format</Label>
          <Select value={localFormat} onValueChange={setLocalFormat}>
            <SelectTrigger id="format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INV-NNNN">Prefix + Number (INV-0001)</SelectItem>
              <SelectItem value="YYYY-NNNN">Year + Number (2026-0001)</SelectItem>
              <SelectItem value="NNNN">Number Only (0001)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {localFormat === "INV-NNNN" && (
          <div className="space-y-2">
            <Label htmlFor="prefix">Invoice Prefix</Label>
            <Input
              id="prefix"
              value={localPrefix}
              onChange={(e) => setLocalPrefix(e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={10}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="nextNumber">Next Invoice Number</Label>
          <Input
            id="nextNumber"
            type="number"
            min="1"
            value={localNextNumber}
            onChange={(e) => setLocalNextNumber(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The next invoice will use this number and auto-increment
          </p>
        </div>

        <div className="p-4 rounded-md bg-muted/30 border">
          <div className="text-sm text-muted-foreground mb-1">Next invoice number preview:</div>
          <div className="text-2xl font-bold font-mono">{getPreview()}</div>
        </div>

        {hasChanges && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalPrefix(prefix);
                setLocalNextNumber(nextNumber.toString());
                setLocalFormat(format);
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
