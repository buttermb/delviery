import { Share2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';

interface NativeShareProps {
  title: string;
  text: string;
  url?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function NativeShare({ title, text, url, variant = 'outline', size = 'sm' }: NativeShareProps) {
  const shareUrl = url || window.location.href;

  const handleShare = async () => {
    haptics.light();

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl
        });
        haptics.success();
      } catch (error) {
        // User cancelled, do nothing
        console.log('Share cancelled');
      }
    } else {
      // Fallback to copy link
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        haptics.success();
      } catch (error) {
        toast.error('Failed to copy link');
        haptics.error();
      }
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleShare}>
      {navigator.share ? (
        <>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </>
      )}
    </Button>
  );
}
