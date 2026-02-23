/**
 * Local AI Page
 * Run AI models locally without API fees (Ollama, LocalAI, Transformers.js)
 */

import { LocalAIIntegration } from '@/components/admin/ai/LocalAIIntegration';
import { SEOHead } from '@/components/SEOHead';

export default function LocalAIPage() {
  return (
    <>
      <SEOHead title="Local AI Assistant" />
      <div className="container mx-auto p-4">
        <LocalAIIntegration />
      </div>
    </>
  );
}

