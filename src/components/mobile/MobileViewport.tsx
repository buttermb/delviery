import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export function useMobileViewport() {
  const isMobile = useIsMobile();
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateViewport = () => {
      setViewportHeight(window.innerHeight);
    };
    
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  return {
    isMobile,
    viewportHeight,
    isPortrait: viewportHeight > window.innerWidth,
  };
}

interface MobileViewportProps {
  children: (viewport: ReturnType<typeof useMobileViewport>) => React.ReactNode;
}

export function MobileViewport({ children }: MobileViewportProps) {
  const viewport = useMobileViewport();
  return <>{children(viewport)}</>;
}

