/**
 * Local AI Page
 * Run AI models locally without API fees (Ollama, LocalAI, Transformers.js)
 */

import { LocalAIIntegration } from '@/components/admin/ai/LocalAIIntegration';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { useNavigate } from 'react-router-dom';

export default function LocalAIPage() {
  return (
    <>
      <SEOHead title="Local AI Assistant" />
      <div className="container mx-auto p-6">
        <LocalAIIntegration />
      </div>
    </>
  );
}

