import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComplianceStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export function ComplianceStep({ formData, updateFormData }: ComplianceStepProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadCOA = async (file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `coa-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      updateFormData({ coa_url: publicUrl });
      toast({ title: "COA uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      uploadCOA(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Compliance & Lab Testing</h2>
        <p className="text-muted-foreground">
          Upload COA and verify compliance requirements
        </p>
      </div>

      <div>
        <Label>Certificate of Analysis (COA) *</Label>
        {formData.coa_url ? (
          <Card className="mt-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">COA Document Uploaded</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.coa_filename || "Certificate of Analysis"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(formData.coa_url, "_blank")}
                >
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFormData({ coa_url: "", coa_filename: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mt-3 border-2 border-dashed">
            <div className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Upload COA PDF</p>
              <p className="text-sm text-muted-foreground mb-4">
                Required: Lab test certificate (PDF only, max 10MB)
              </p>
              <label htmlFor="coa-upload">
                <Button variant="outline" disabled={uploading} asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Browse PDF Files"}
                  </span>
                </Button>
              </label>
              <input
                id="coa-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lab-name">Lab Name</Label>
          <Input
            id="lab-name"
            value={formData.lab_name || ""}
            onChange={(e) => updateFormData({ lab_name: e.target.value })}
            placeholder="Testing lab name"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="test-date">Test Date</Label>
          <Input
            id="test-date"
            type="date"
            value={formData.test_date || ""}
            onChange={(e) => updateFormData({ test_date: e.target.value })}
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="batch">Batch/Lot Number</Label>
        <Input
          id="batch"
          value={formData.batch_number || ""}
          onChange={(e) => updateFormData({ batch_number: e.target.value })}
          placeholder="Batch ID"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Contaminant Testing</Label>
        <div className="space-y-2 mt-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="pesticide" defaultChecked />
            <Label htmlFor="pesticide" className="font-normal cursor-pointer">
              ✓ Passed Pesticide Test
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="heavy-metals" defaultChecked />
            <Label htmlFor="heavy-metals" className="font-normal cursor-pointer">
              ✓ Passed Heavy Metals Test
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="microbial" defaultChecked />
            <Label htmlFor="microbial" className="font-normal cursor-pointer">
              ✓ Passed Microbial Test
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="solvent" defaultChecked />
            <Label htmlFor="solvent" className="font-normal cursor-pointer">
              ✓ Passed Solvent Test
            </Label>
          </div>
        </div>
      </div>

      <Card className="p-4 bg-muted">
        <h3 className="font-semibold mb-3">Compliance Checklist</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="thc-limit" defaultChecked />
            <Label htmlFor="thc-limit" className="font-normal cursor-pointer text-sm">
              ✓ Contains ≤0.3% Delta-9 THC
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="lab-tested" defaultChecked />
            <Label htmlFor="lab-tested" className="font-normal cursor-pointer text-sm">
              ✓ Lab tested by approved facility
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="age-21" defaultChecked />
            <Label htmlFor="age-21" className="font-normal cursor-pointer text-sm">
              ✓ Age restriction (21+) applied
            </Label>
          </div>
        </div>
      </Card>
    </div>
  );
}
