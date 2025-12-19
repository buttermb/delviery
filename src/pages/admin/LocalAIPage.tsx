/**
 * Local AI Page
 * Run AI models locally without API fees (Ollama, LocalAI, Transformers.js)
 */

import { LocalAIIntegration } from '@/components/admin/ai/LocalAIIntegration';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LocalAIPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOHead title="Local AI Assistant" />
      <div className="container mx-auto p-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <LocalAIIntegration />
      </div>
    </>
  );
}

