import { Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { haptics } from '@/utils/haptics';

interface ContactButtonsProps {
  phone: string;
  name?: string;
}

export function ContactButtons({ phone, name }: ContactButtonsProps) {
  const formattedPhone = phone.replace(/\D/g, '');

  const handleCall = () => {
    haptics.medium();
  };

  const handleSMS = () => {
    haptics.medium();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        asChild
        variant="default"
        className="w-full"
        onClick={handleCall}
      >
        <a href={`tel:${formattedPhone}`}>
          <Phone className="w-4 h-4 mr-2" />
          Call {name || 'Phone'}
        </a>
      </Button>
      <Button
        asChild
        variant="outline"
        className="w-full"
        onClick={handleSMS}
      >
        <a href={`sms:${formattedPhone}`}>
          <MessageSquare className="w-4 h-4 mr-2" />
          Text
        </a>
      </Button>
    </div>
  );
}
