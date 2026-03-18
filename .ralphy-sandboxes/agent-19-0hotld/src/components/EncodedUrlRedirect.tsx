import { useEffect } from "react";
import { LoadingFallback } from "./LoadingFallback";
import { logger } from "@/lib/logger";

/**
 * Handles URLs that have been incorrectly encoded (e.g., %3F instead of ?)
 * Decodes and redirects to the correct URL
 */
export function EncodedUrlRedirect() {
  useEffect(() => {
    const currentPath = window.location.pathname;
    const search = window.location.search;
    
    logger.info('[URL_REDIRECT] Handling encoded URL', { 
      currentPath, 
      search,
      fullUrl: window.location.href 
    });
    
    // Decode the URL path
    const decodedPath = decodeURIComponent(currentPath);
    
    // If the path contains a query string (was encoded), extract and fix it
    if (decodedPath.includes('?')) {
      const [path, queryString] = decodedPath.split('?');
      const newUrl = path + '?' + queryString + search;
      
      logger.info('[URL_REDIRECT] Redirecting to decoded URL', { 
        from: window.location.href, 
        to: newUrl 
      });
      
      // Use replace to avoid adding to history
      window.location.replace(newUrl);
    } else {
      // If no encoding issue, just go to the decoded path
      const newUrl = decodedPath + search;
      
      if (newUrl !== currentPath + search) {
        logger.info('[URL_REDIRECT] Redirecting to decoded URL', { 
          from: window.location.href, 
          to: newUrl 
        });
        window.location.replace(newUrl);
      }
    }
  }, []);
  
  return <LoadingFallback />;
}
