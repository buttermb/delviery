import { logger } from '@/lib/logger';
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { validateFile, generateSecureStoragePath, FILE_SIZE_LIMITS, formatFileSize } from "@/lib/fileValidation";

export default function IDVerificationUpload() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    idType: "",
    idNumber: "",
    dateOfBirth: "",
  });
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous error for this field
    setFileErrors(prev => ({ ...prev, [type]: '' }));

    // Validate the file
    const validation = await validateFile(file, {
      context: 'idVerification',
      maxSize: FILE_SIZE_LIMITS.image,
    });

    if (!validation.isValid) {
      setFileErrors(prev => ({ ...prev, [type]: validation.error || 'Invalid file' }));
      // Clear the input
      e.target.value = '';
      toast.error(validation.error || 'Invalid file');
      return;
    }

    if (type === "front") setIdFrontFile(file);
    if (type === "back") setIdBackFile(file);
    if (type === "selfie") setSelfieFile(file);
  };

  const uploadFile = async (file: File, prefix: string) => {
    // Generate secure storage path with user isolation
    const storagePath = generateSecureStoragePath(file.name, prefix, user?.id);

    const { error } = await supabase.storage
      .from("id-verifications")
      .upload(storagePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("id-verifications")
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !idFrontFile || !selfieFile) {
      toast.error("Please upload required documents");
      return;
    }

    if (!formData.idType || !formData.dateOfBirth) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      // Use secure upload paths with prefixes instead of timestamp-based names
      const idFrontUrl = await uploadFile(idFrontFile, 'id-front');
      const idBackUrl = idBackFile ? await uploadFile(idBackFile, 'id-back') : null;
      const selfieUrl = await uploadFile(selfieFile, 'selfie');

      const { error: verificationError } = await supabase
        .from("age_verifications")
        .insert({
          user_id: user.id,
          date_of_birth: formData.dateOfBirth,
          verification_type: "manual_review",
          verification_method: "document_upload",
          id_type: formData.idType,
          id_number: formData.idNumber,
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl,
          selfie_url: selfieUrl,
          verified: false,
        });

      if (verificationError) throw verificationError;

      toast.success("ID verification submitted! We'll review it within 24 hours.");
      setSubmitted(true);
    } catch (error: unknown) {
      logger.error("Verification error", error, { component: 'IDVerificationUpload' });
      toast.error("Failed to submit verification");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Verification Submitted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your ID verification has been submitted and is under review. 
            We'll notify you once it's approved (usually within 24 hours).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Verify Your Identity (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idType">ID Type *</Label>
            <Select value={formData.idType} onValueChange={(value) => setFormData({ ...formData, idType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select ID type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drivers_license">Driver's License</SelectItem>
                <SelectItem value="state_id">State ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 21)).toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idNumber">ID Number (Optional)</Label>
            <Input
              id="idNumber"
              type="text"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              placeholder="Last 4 digits only"
              maxLength={4}
            />
          </div>

          <div className="space-y-2">
            <Label>ID Front * (Required)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, "front")}
                required
              />
              {idFrontFile && <CheckCircle className="w-5 h-5 text-green-600" />}
              {fileErrors.front && <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            {fileErrors.front && <p className="text-sm text-red-600">{fileErrors.front}</p>}
            <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Max {formatFileSize(FILE_SIZE_LIMITS.image)}.</p>
          </div>

          <div className="space-y-2">
            <Label>ID Back (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, "back")}
              />
              {idBackFile && <CheckCircle className="w-5 h-5 text-green-600" />}
              {fileErrors.back && <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            {fileErrors.back && <p className="text-sm text-red-600">{fileErrors.back}</p>}
          </div>

          <div className="space-y-2">
            <Label>Selfie with ID * (Required)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, "selfie")}
                required
              />
              {selfieFile && <CheckCircle className="w-5 h-5 text-green-600" />}
              {fileErrors.selfie && <AlertCircle className="w-5 h-5 text-red-600" />}
            </div>
            {fileErrors.selfie && <p className="text-sm text-red-600">{fileErrors.selfie}</p>}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">Benefits of Verification:</p>
            <ul className="space-y-1">
              <li>• Unlock higher spending limits</li>
              <li>• Get priority delivery</li>
              <li>• Access exclusive deals</li>
            </ul>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            {loading ? "Uploading..." : "Submit Verification"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
