import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

interface SEOMetaTagsProps {
  tenantSlug?: string;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
}

export function SEOMetaTags({
  tenantSlug,
  title,
  description,
  image,
  url,
  type = 'website',
}: SEOMetaTagsProps) {
  const { data: seoSettings } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenantSlug, 'seo'),
    queryFn: async () => {
      if (!tenantSlug) return null;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return null;

      const metadata = tenant.metadata as Record<string, unknown> || {};
      return metadata.seo_settings as Record<string, unknown> | undefined;
    },
    enabled: !!tenantSlug,
  });

  const siteTitle = title || (seoSettings?.site_title as string) || 'FloraIQ';
  const siteDescription = description || (seoSettings?.site_description as string) || '';
  const ogImage = image || (seoSettings?.og_image_url as string) || '';
  const twitterHandle = (seoSettings?.twitter_handle as string) || '';
  const keywords = (seoSettings?.site_keywords as string) || '';

  return (
    <Helmet>
      <title>{siteTitle}</title>
      <meta name="description" content={siteDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={siteDescription} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {url && <meta property="og:url" content={url} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={siteDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {twitterHandle && <meta name="twitter:site" content={`@${twitterHandle}`} />}
    </Helmet>
  );
}
