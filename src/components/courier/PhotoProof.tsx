import { logger } from '@/lib/logger';
// @ts-nocheck
import { Camera, CameraType } from 'react-camera-pro';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera as CameraIcon, RotateCcw, CheckCircle, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhotoProofProps {
  orderId: string;
  onPhotoUploaded: (photoUrl: string) => void;
}

export function PhotoProof({ orderId, onPhotoUploaded }: PhotoProofProps) {
  const camera = useRef<CameraType | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const takePhoto = () => {
    if (camera.current) {
      const photo = camera.current.takePhoto();
      setImage(photo);
    }
  };

  const retake = () => {
    setImage(null);
  };

  const uploadPhoto = async () => {
    if (!image) return;

    setUploading(true);
    try {
      // Convert base64 to blob using safeFetch
      const { safeFetch } = await import('@/utils/safeFetch');
      const response = await safeFetch(image);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const fileName = `${orderId}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('delivery-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('delivery-photos')
        .getPublicUrl(fileName);

      onPhotoUploaded(publicUrl);
      toast.success('Photo uploaded successfully!');
    } catch (error) {
      logger.error('Failed to upload photo', error, { component: 'PhotoProof', orderId });
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CameraIcon className="w-5 h-5" />
          Photo Proof of Delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!image ? (
          <>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <Camera
                ref={camera}
                aspectRatio={16 / 9}
                facingMode="environment"
                errorMessages={{
                  noCameraAccessible: 'No camera device accessible. Please connect your camera or try a different browser.',
                  permissionDenied: 'Permission denied. Please refresh and give camera permission.',
                  switchCamera: 'It is not possible to switch camera to different one because there is only one video device accessible.',
                  canvas: 'Canvas is not supported.'
                }}
              />
            </div>
            <Button
              onClick={takePhoto}
              className="w-full"
              size="lg"
            >
              <CameraIcon className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
          </>
        ) : (
          <>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={image}
                alt="Delivery proof"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={retake}
                variant="outline"
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={uploadPhoto}
                className="flex-1"
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </>
        )}

        <div className="text-xs text-center text-muted-foreground">
          Photo will be attached to order #{orderId.slice(0, 8).toUpperCase()}
        </div>
      </CardContent>
    </Card>
  );
}