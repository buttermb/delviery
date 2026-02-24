/**
 * Local AI Integration Component
 * Inspired by Ollama, LocalAI, and Transformers.js
 * Run AI models locally without API fees
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  Sparkles,
  Loader2,
  MessageSquare,
  FileText,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
// Demo Mode: Simulated AI processing
// In production, integrate with @xenova/transformers, Ollama, or Lovable AI
async function runLocalAI(prompt: string, model: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Demo responses with clear labeling
  const responses: Record<string, string> = {
    'sentiment': `[DEMO MODE] Sentiment Analysis: This is a simulated response. In production, connect to real AI models via Lovable AI or local processing.`,
    'summary': `[DEMO MODE] Summary: This is a placeholder summary. Real AI summarization requires integration with supported AI models.`,
    'classification': `[DEMO MODE] Classification: Demo classification result. Connect real AI to classify customer inquiries automatically.`,
    'translation': `[DEMO MODE] Translation: Demo translation output. Real translation requires AI model integration.`,
  };
  
  return responses[model] || `[DEMO MODE] AI Response: ${prompt.substring(0, 100)}...`;
}

interface AIModel {
  id: string;
  name: string;
  description: string;
  type: 'ollama' | 'localai' | 'transformers';
  status: 'available' | 'loading' | 'offline';
}

export function LocalAIIntegration() {
  const [selectedModel, setSelectedModel] = useState<string>('sentiment');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const models: AIModel[] = [
    {
      id: 'sentiment',
      name: 'Sentiment Analysis',
      description: 'Analyze customer message sentiment',
      type: 'transformers',
      status: 'available',
    },
    {
      id: 'summary',
      name: 'Text Summarization',
      description: 'Summarize long customer messages',
      type: 'transformers',
      status: 'available',
    },
    {
      id: 'classification',
      name: 'Message Classification',
      description: 'Classify customer inquiries',
      type: 'transformers',
      status: 'available',
    },
    {
      id: 'translation',
      name: 'Translation',
      description: 'Translate customer messages',
      type: 'transformers',
      status: 'available',
    },
  ];

  const handleProcess = async () => {
    if (!input.trim()) {
      toast.error("Please enter some text to process");
      return;
    }

    setIsProcessing(true);
    setOutput('');

    try {
      const result = await runLocalAI(input, selectedModel);
      setOutput(result);
      toast.success("Text processed successfully");
    } catch (error: unknown) {
      toast.error("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const getModelBadge = (type: string) => {
    switch (type) {
      case 'ollama': return <Badge variant="outline" className="bg-info/10 text-info border-info">Ollama</Badge>;
      case 'localai': return <Badge variant="outline" className="bg-[hsl(var(--super-admin-secondary))]/10 text-[hsl(var(--super-admin-secondary))] border-[hsl(var(--super-admin-secondary))]">LocalAI</Badge>;
      case 'transformers': return <Badge variant="outline" className="bg-success/10 text-success border-success">Browser</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Local AI Assistant
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Run AI models locally - no API fees, no external services
          </p>
        </div>
        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500">
          <Zap className="h-3 w-3 mr-1" />
          Demo Mode
        </Badge>
      </div>

      {/* Available Models */}
      <Card>
        <CardHeader>
          <CardTitle>Available AI Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {models.map((model) => (
              <Card
                key={model.id}
                className={`cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selectedModel === model.id
                    ? 'ring-2 ring-primary'
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedModel(model.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedModel(model.id); } }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold">{model.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {model.description}
                      </p>
                    </div>
                    {getModelBadge(model.type)}
                  </div>
                  <Badge
                    variant={model.status === 'available' ? 'default' : 'secondary'}
                    className="mt-2"
                  >
                    {model.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Processing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Enter text to process..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
            />
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !input.trim()}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : output ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{output}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(output);
                      toast.success("Output copied to clipboard");
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOutput('')}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>AI output will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-info mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Local AI Models</h3>
              <p className="text-sm text-muted-foreground mb-3">
                These AI models run locally in your browser or on your server. 
                No data is sent to external services, ensuring complete privacy.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Ollama:</strong> Run LLMs on your server
                </div>
                <div>
                  <strong>LocalAI:</strong> OpenAI-compatible local API
                </div>
                <div>
                  <strong>Transformers.js:</strong> Browser-based AI models
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

