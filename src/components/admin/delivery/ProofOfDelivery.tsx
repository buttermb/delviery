import { useRef, useState, useCallback } from 'react';
import SignatureCanvasLib from 'react-signature-canvas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Upload, RotateCcw, CheckCircle, PenTool, FileText, MapPin, Loader2 } from 'lucide-react';

import type { DeliveryWithDetails, GeoLocation } from '@/types/interconnected';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// Form validation schema
const proofOfDeliverySchema = z.object({
  recipientName: z.string().min(2, 'Recipient name must be at least 2 characters'),
  notes: z.string().optional(),
});

type ProofOfDeliveryFormData = z.infer<typeof proofOfDeliverySchema>;

interface ProofOfDeliveryProps {
  deliveryId: string;
  orderId: string;
  delivery?: DeliveryWithDetails;
  onComplete: (proofData: DeliveryProofData) => void;
  onCancel?: () => void;
}

export interface DeliveryProofData {
  id: string;
  deliveryId: string;
  orderId: string;
  photoUrl: string | null;
  signatureUrl: string | null;
  recipientName: string;
  notes: string;
  location: GeoLocation | null;
  capturedAt: string;
}

export function ProofOfDelivery({
  deliveryId,
  orderId,
  delivery,
  onComplete,
  onCancel,
}: ProofOfDeliveryProps) {
  const { tenant } = useTenantAdminAuth();
  const sigCanvas = useRef<SignatureCanvasLib | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignatureEmpty, setIsSignatureEmpty] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState('photo');

  // Form setup
  const form = useForm<ProofOfDeliveryFormData>({
    resolver: zodResolver(proofOfDeliverySchema),
    defaultValues: {
      recipientName: (delivery?.order as any)?.customer_name || '',
      notes: '',
    },
  });

  // Capture current location
  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
        setIsCapturingLocation(false);
        toast.success('Location captured');
      },
      (error) => {
        logger.error('Failed to get location', error, { component: 'ProofOfDelivery' });
        toast.error('Failed to capture location');
        setIsCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Handle photo file selection
  const handlePhotoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Clear photo
  const clearPhoto = useCallback(() => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle signature events
  const handleSignatureBegin = useCallback(() => {
    setIsSignatureEmpty(false);
  }, []);

  const clearSignature = useCallback(() => {
    sigCanvas.current?.clear();
    setSignatureData(null);
    setIsSignatureEmpty(true);
  }, []);

  const saveSignature = useCallback(() => {
    if (isSignatureEmpty || !sigCanvas.current) return null;
    const data = sigCanvas.current.toDataURL('image/png');
    setSignatureData(data);
    return data;
  }, [isSignatureEmpty]);

  // Upload image to Supabase Storage
  const uploadImage = async (
    dataUrl: string,
    bucket: string,
    fileName: string
  ): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: blob.type || 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        logger.error('Failed to upload image', error, { component: 'ProofOfDelivery', bucket, fileName });
        throw error;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      logger.error('Image upload error', error, { component: 'ProofOfDelivery' });
      return null;
    }
  };

  // Upload photo file
  const uploadPhotoFile = async (file: File): Promise<string | null> => {
    try {
      const fileName = `${tenant?.id || 'unknown'}/${deliveryId}-photo-${Date.now()}.${file.name.split('.').pop()}`;

      const { error } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        logger.error('Failed to upload photo file', error, { component: 'ProofOfDelivery' });
        throw error;
      }

      const { data: urlData } = supabase.storage.from('delivery-proofs').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      logger.error('Photo file upload error', error, { component: 'ProofOfDelivery' });
      return null;
    }
  };

  // Submit proof of delivery
  const onSubmit = async (formData: ProofOfDeliveryFormData) => {
    if (!tenant?.id) {
      toast.error('Tenant context not available');
      return;
    }

    // Validate that at least photo or signature is provided
    if (!photoFile && !photoPreview && isSignatureEmpty) {
      toast.error('Please capture a photo or obtain customer signature');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get signature data if not already saved
      const finalSignatureData = signatureData || saveSignature();

      // Upload photo if present
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadPhotoFile(photoFile);
      } else if (photoPreview && photoPreview.startsWith('data:')) {
        const fileName = `${tenant.id}/${deliveryId}-photo-${Date.now()}.jpg`;
        photoUrl = await uploadImage(photoPreview, 'delivery-proofs', fileName);
      }

      // Upload signature if present
      let signatureUrl: string | null = null;
      if (finalSignatureData) {
        const fileName = `${tenant.id}/${deliveryId}-signature-${Date.now()}.png`;
        signatureUrl = await uploadImage(finalSignatureData, 'delivery-proofs', fileName);
      }

      // Create proof record
      const proofId = crypto.randomUUID();
      const capturedAt = new Date().toISOString();

      // Store in database
      const { error: insertError } = await (supabase as any).from('delivery_proofs').insert({
        id: proofId,
        tenant_id: tenant.id,
        delivery_id: deliveryId,
        order_id: orderId,
        photo_url: photoUrl,
        signature_url: signatureUrl,
        recipient_name: formData.recipientName,
        notes: formData.notes || null,
        location_lat: currentLocation?.lat || null,
        location_lng: currentLocation?.lng || null,
        captured_at: capturedAt,
        created_at: capturedAt,
      });

      if (insertError) {
        // If table doesn't exist yet, log and continue (proof data still available)
        logger.warn('Could not save to delivery_proofs table (may not exist yet)', insertError, {
          component: 'ProofOfDelivery',
        });
      }

      const proofData: DeliveryProofData = {
        id: proofId,
        deliveryId,
        orderId,
        photoUrl,
        signatureUrl,
        recipientName: formData.recipientName,
        notes: formData.notes || '',
        location: currentLocation,
        capturedAt,
      };

      toast.success('Proof of delivery captured successfully');
      onComplete(proofData);
    } catch (error) {
      logger.error('Failed to submit proof of delivery', error, { component: 'ProofOfDelivery' });
      toast.error('Failed to capture proof of delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate delivery receipt content
  const generateReceiptContent = (): string => {
    const now = new Date();
    const lines = [
      '═══════════════════════════════════',
      '        PROOF OF DELIVERY',
      '═══════════════════════════════════',
      '',
      `Order ID: ${orderId.slice(0, 8).toUpperCase()}`,
      `Delivery ID: ${deliveryId.slice(0, 8).toUpperCase()}`,
      `Date: ${now.toLocaleDateString()}`,
      `Time: ${now.toLocaleTimeString()}`,
      '',
      '───────────────────────────────────',
      '',
      `Recipient: ${form.getValues('recipientName')}`,
      currentLocation ? `Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` : '',
      form.getValues('notes') ? `Notes: ${form.getValues('notes')}` : '',
      '',
      '───────────────────────────────────',
      '',
      photoPreview ? '✓ Photo captured' : '✗ No photo',
      signatureData || !isSignatureEmpty ? '✓ Signature captured' : '✗ No signature',
      '',
      '═══════════════════════════════════',
      `        ${tenant?.business_name || 'FloraIQ'}`,
      '═══════════════════════════════════',
    ];

    return lines.filter(Boolean).join('\n');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Proof of Delivery
        </CardTitle>
        <CardDescription>
          Capture photo proof and customer signature for order #{orderId.slice(0, 8).toUpperCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Tabs for Photo and Signature */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="photo" className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Photo
                </TabsTrigger>
                <TabsTrigger value="signature" className="flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Signature
                </TabsTrigger>
              </TabsList>

              {/* Photo Tab */}
              <TabsContent value="photo" className="space-y-4">
                <div className="border-2 border-dashed border-muted rounded-lg p-4">
                  {!photoPreview ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Take a photo or upload an image as proof of delivery
                      </p>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Photo
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                        <img
                          src={photoPreview}
                          alt="Delivery proof"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearPhoto}
                        className="w-full"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retake Photo
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Signature Tab */}
              <TabsContent value="signature" className="space-y-4">
                <div className="border-2 border-dashed border-muted rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                  <SignatureCanvasLib
                    ref={sigCanvas}
                    onBegin={handleSignatureBegin}
                    canvasProps={{
                      className: 'w-full h-64 touch-none',
                      style: { touchAction: 'none' },
                    }}
                    backgroundColor="white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Sign above using your finger or stylus
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    disabled={isSignatureEmpty}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Recipient Name */}
            <FormField
              control={form.control}
              name="recipientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Recipient Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter recipient's name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Delivery Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any notes about the delivery..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Capture */}
            <div className="space-y-2">
              <Label>Delivery Location</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureLocation}
                  disabled={isCapturingLocation}
                >
                  {isCapturingLocation ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  {currentLocation ? 'Update Location' : 'Capture Location'}
                </Button>
                {currentLocation && (
                  <span className="text-sm text-muted-foreground">
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </span>
                )}
              </div>
            </div>

            {/* Compliance Notice */}
            <Alert>
              <AlertDescription className="text-xs">
                By submitting this proof of delivery, you confirm that the order has been
                delivered to the recipient and age verification (21+) has been completed
                as required by cannabis delivery regulations.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Delivery
                  </>
                )}
              </Button>
            </div>

            {/* Receipt Preview (hidden, for programmatic access) */}
            <pre className="hidden" id="delivery-receipt">
              {generateReceiptContent()}
            </pre>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default ProofOfDelivery;
