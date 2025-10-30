import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  structuredData?: object;
  schema?: object; // Alias for structuredData
}

export const SEOHead = ({ 
  title = 'New York Minute NYC - Premium Flower Delivery',
  description = 'Premium flower delivery across NYC. Fast, discreet delivery to Manhattan, Brooklyn & Queens. Lab-tested products from licensed vendors.',
  image = 'https://lovable.dev/opengraph-image-p98pqg.png',
  type = 'website',
  structuredData,
  schema
}: SEOHeadProps) => {
  const location = useLocation();
  const url = `https://65e49124-2bb1-4ef2-904b-5dcf255784da.lovableproject.com${location.pathname}`;
  const finalSchema = schema || structuredData; // Support both prop names

  useEffect(() => {
    // Update title
    document.title = title;

    // Update meta tags
    const updateMeta = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.name = name;
        document.head.appendChild(element);
      }
      element.content = content;
    };

    const updateProperty = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    updateMeta('description', description);
    updateProperty('og:title', title);
    updateProperty('og:description', description);
    updateProperty('og:image', image);
    updateProperty('og:url', url);
    updateProperty('og:type', type);
    updateMeta('twitter:title', title);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', image);

    // Add canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    // Add structured data
    if (finalSchema) {
      let script = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(finalSchema);
    }
  }, [title, description, image, type, url, finalSchema]);

  return null;
};
