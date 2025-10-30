import { 
  FacebookShareButton, 
  TwitterShareButton, 
  WhatsappShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon 
} from 'react-share';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
}

export function SocialShare({ url, title, description }: SocialShareProps) {
  const shareUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 justify-center py-6">
          <FacebookShareButton url={shareUrl} hashtag="#BudDashNYC">
            <FacebookIcon size={48} round />
          </FacebookShareButton>
          <TwitterShareButton url={shareUrl} title={title}>
            <TwitterIcon size={48} round />
          </TwitterShareButton>
          <WhatsappShareButton url={shareUrl} title={title} separator=" - ">
            <WhatsappIcon size={48} round />
          </WhatsappShareButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
