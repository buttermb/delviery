import { useState, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import Camera from "lucide-react/dist/esm/icons/camera";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  validateImageDimensions,
  IMAGE_DIMENSION_CONSTRAINTS,
} from '@/lib/utils/validation';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName?: string | null;
  onUploadComplete?: (publicUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `Invalid file type. Accepted types: JPEG, PNG, GIF, WebP`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`;
  }
  return null;
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-20 w-20 sm:h-24 sm:w-24',
  lg: 'h-28 w-28 sm:h-32 sm:w-32',
} as const;

const initialsSize = {
  sm: 'text-lg',
  md: 'text-xl sm:text-2xl',
  lg: 'text-2xl sm:text-3xl',
} as const;

const iconSize = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-7 w-7',
} as const;

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  userName,
  onUploadComplete,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentAvatarUrl || undefined;

  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected
    e.target.value = '';

    // Validate file type and size
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: 'Invalid file',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    // Validate image dimensions
    const dimensionResult = await validateImageDimensions(
      file,
      IMAGE_DIMENSION_CONSTRAINTS.avatar
    );

    if (!dimensionResult.valid) {
      toast({
        title: 'Invalid image dimensions',
        description: dimensionResult.error,
        variant: 'destructive',
      });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase storage
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user_profiles.avatar_url via edge function
      const { data: updateData, error: updateError } = await supabase.functions.invoke(
        'update-account-profile',
        { body: { avatar_url: publicUrl } }
      );

      if (updateError) throw updateError;

      if (updateData && typeof updateData === 'object' && 'error' in updateData && updateData.error) {
        throw new Error(
          typeof updateData.error === 'string' ? updateData.error : 'Failed to update avatar'
        );
      }

      setUploadProgress(100);
      setPreviewUrl(publicUrl);

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been changed.',
      });

      onUploadComplete?.(publicUrl);
    } catch (error: unknown) {
      logger.error('Avatar upload failed', error);
      // Revert preview on failure
      setPreviewUrl(null);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset progress after a brief delay so user sees 100%
      setTimeout(() => setUploadProgress(0), 500);
    }
  }, [userId, onUploadComplete]);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], 'ring-4 ring-background shadow-xl')}>
          <AvatarImage src={displayUrl} alt={userName || 'User avatar'} />
          <AvatarFallback
            className={cn(
              initialsSize[size],
              'bg-gradient-to-br from-primary/80 to-primary text-primary-foreground'
            )}
          >
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          aria-label="Change avatar"
          className={cn(
            'absolute inset-0 rounded-full flex items-center justify-center',
            'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
            'cursor-pointer touch-manipulation active:opacity-100',
            isUploading && 'opacity-100 cursor-wait'
          )}
        >
          {isUploading ? (
            <Loader2 className={cn(iconSize[size], 'text-white animate-spin')} />
          ) : (
            <Camera className={cn(iconSize[size], 'text-white')} />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {isUploading && uploadProgress > 0 && (
        <Progress value={uploadProgress} className="w-full max-w-[120px] h-1.5" />
      )}
    </div>
  );
}
