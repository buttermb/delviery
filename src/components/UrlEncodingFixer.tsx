import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";

/**
 * Global URL encoding fixer
 * Detects and fixes URLs where query strings were incorrectly encoded as path segments
 * e.g., /select-plan%3Ftenant_id=xxx → /select-plan?tenant_id=xxx
 */
export function UrlEncodingFixer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Check if the path contains encoded characters that shouldn't be there
    if (currentPath.includes('%3F') || currentPath.includes('%3D') || currentPath.includes('%26')) {
      // Decode the path
      const decodedPath = decodeURIComponent(currentPath);
      
      // If the decoded path contains a query string, split and fix it
      if (decodedPath.includes('?')) {
        const [path, queryString] = decodedPath.split('?');
        const existingSearch = location.search ? location.search.substring(1) : '';
        const newSearch = existingSearch ? `${queryString}&${existingSearch}` : queryString;
        const newUrl = `${path}?${newSearch}`;
        
        logger.info('[URL_FIXER] Fixing encoded URL', { 
          from: currentPath + location.search, 
          to: newUrl 
        });
        
        // Navigate to the fixed URL
        navigate(newUrl, { replace: true });
      }
    }
  }, [location.pathname, location.search, navigate]);

  return null; // This component renders nothing
}

