import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/utils/haptics';
import { useIsMobile } from '@/hooks/use-mobile';

export function BackToTop() {
  const [show, setShow] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    haptics.medium();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isMobile) return null;

  return (
    <Button
      size="icon"
      variant="hero"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-32 right-4 z-40 h-12 w-12 rounded-full shadow-2xl transition-all duration-300",
        "min-h-[48px] min-w-[48px]",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      )}
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
