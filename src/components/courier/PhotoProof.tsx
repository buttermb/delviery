import { Camera } from 'react-camera-pro';
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
  const camera = useRef<any>(null);
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
      // Convert base64 to blob
      const response = await fetch(image);
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

      toast.success('Photo uploaded successfully!');
      onPhotoUploaded(publicUrl);
      
    } catch (error) {
      console.error('Upload error:', error);
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
          Delivery Photo Proof
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Take a photo of the delivered package
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
          {!image ? (
            <Camera 
              ref={camera} 
              aspectRatio={9 / 16}
              facingMode="environment"
              errorMessages={{
                noCameraAccessible: 'No camera accessible. Please allow camera access.',
                permissionDenied: 'Permission denied. Please allow camera access.',
                switchCamera: 'Unable to switch camera.',
                canvas: 'Canvas not supported.'
              }}
            />
          ) : (
            <img 
              src={image} 
              alt="Delivery proof" 
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {!image ? (
          <Button
            onClick={takePhoto}
            className="w-full"
            size="lg"
          >
            <CameraIcon className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              onClick={retake}
              variant="outline"
              className="flex-1"
              disabled={uploading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button
              onClick={uploadPhoto}
              className="flex-1"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            This photo will be saved as proof of delivery
          </p>
        </div>
      </CardContent>
    </Card>
  );
}