import { useEffect, useState, useRef } from 'react';

/**
 * Hook to detect when mobile keyboard is open
 * Helps adjust viewport and scroll inputs into view
 */
export function useKeyboardDetection() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const initialHeightRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use visualViewport API if available (more accurate for mobile keyboards)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const currentHeight = window.visualViewport!.height;
        const heightDiff = initialHeightRef.current - currentHeight;
        
        // If viewport shrinks by more than 150px, keyboard is likely open
        const keyboardOpen = heightDiff > 150;
        setIsKeyboardOpen(keyboardOpen);
        
        if (keyboardOpen) {
          scrollYRef.current = window.scrollY;
          document.body.classList.add('keyboard-open');
          // Prevent body scroll when keyboard is open
          document.body.style.top = `-${scrollYRef.current}px`;
        } else {
          // Always ensure cleanup happens
          document.body.classList.remove('keyboard-open');
          document.body.style.position = '';
          // Restore scroll position
          const scrollY = scrollYRef.current;
          document.body.style.top = '';
          if (scrollY > 0) {
            window.scrollTo(0, scrollY);
          }
        }
        
        setViewportHeight(currentHeight);
      };
      
      // Initial height
      initialHeightRef.current = window.visualViewport.height;
      setViewportHeight(window.visualViewport.height);
      
      window.visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        // Ensure complete cleanup
        document.body.classList.remove('keyboard-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.overflow = '';
      };
    }

    // Fallback to resize event for browsers without visualViewport
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = initialHeightRef.current - currentHeight;
      
      // If viewport shrinks by more than 150px, keyboard is likely open
      const keyboardOpen = heightDiff > 150;
      setIsKeyboardOpen(keyboardOpen);
      
      if (keyboardOpen) {
        scrollYRef.current = window.scrollY;
        document.body.classList.add('keyboard-open');
        document.body.style.top = `-${scrollYRef.current}px`;
      } else {
        document.body.classList.remove('keyboard-open');
        const scrollY = scrollYRef.current;
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      }
      
      setViewportHeight(currentHeight);
    };

    // Initial viewport height
    initialHeightRef.current = window.innerHeight;
    setViewportHeight(window.innerHeight);

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      // Ensure complete cleanup
      document.body.classList.remove('keyboard-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.overflow = '';
    };
  }, []);

  return { isKeyboardOpen, viewportHeight };
}
