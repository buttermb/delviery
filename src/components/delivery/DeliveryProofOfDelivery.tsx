/**
 * Task 346: Wire delivery proof of delivery system
 * Capture and store proof of delivery (photo, signature)
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, FileSignature, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

interface DeliveryProofOfDeliveryProps {
  deliveryId: string;
  onComplete?: () => void;
}

export function DeliveryProofOfDelivery({ deliveryId, onComplete }: DeliveryProofOfDeliveryProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      let uploadedPhotoUrl = '';

      // Upload photo if provided
      if (photoFile) {
        const fileName = `${deliveryId}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('delivery-photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('delivery-photos')
          .getPublicUrl(fileName);

        uploadedPhotoUrl = publicUrl;
      }

      // Update delivery record
      const { error } = await supabase
        .from('deliveries')
        .update({
          delivery_photo_url: uploadedPhotoUrl || null,
          signature_url: signatureUrl || null,
          actual_dropoff_time: new Date().toISOString(),
        })
        .eq('id', deliveryId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      // Update order status to delivered
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('order_id')
        .eq('id', deliveryId)
        .maybeSingle();

      if (delivery?.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'delivered' })
          .eq('id', delivery.order_id)
          .eq('tenant_id', tenant.id);
      }
    },
    onSuccess: () => {
      toast.success('Proof of delivery submitted');
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      onComplete?.();
    },
    onError: (error) => {
      logger.error('Failed to submit proof of delivery', error);
      toast.error('Failed to submit proof of delivery');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5" />
          Proof of Delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Name</Label>
          <Input
            id="recipient"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo">Delivery Photo</Label>
          <Input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
          {photoFile && (
            <p className="text-sm text-emerald-600">{photoFile.name} selected</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">Signature (URL)</Label>
          <Input
            id="signature"
            value={signatureUrl}
            onChange={(e) => setSignatureUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !recipientName}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {submitMutation.isPending ? 'Submitting...' : 'Submit Proof of Delivery'}
        </Button>
      </CardContent>
    </Card>
  );
}
