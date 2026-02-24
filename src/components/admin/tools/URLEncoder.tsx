/**
 * URL Encoder/Decoder Tool
 * Encode and decode URLs, query parameters, and Base64
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, ArrowRightLeft, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

type EncodingType = 'url' | 'urlComponent' | 'base64';

export function URLEncoder() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [encodingType, setEncodingType] = useState<EncodingType>('url');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const encode = (text: string, type: EncodingType): string => {
    try {
      switch (type) {
        case 'url':
          return encodeURI(text);
        case 'urlComponent':
          return encodeURIComponent(text);
        case 'base64':
          return btoa(unescape(encodeURIComponent(text)));
        default:
          return text;
      }
    } catch (error) {
      return 'Error encoding: ' + (error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const decode = (text: string, type: EncodingType): string => {
    try {
      switch (type) {
        case 'url':
          return decodeURI(text);
        case 'urlComponent':
          return decodeURIComponent(text);
        case 'base64':
          return decodeURIComponent(escape(atob(text)));
        default:
          return text;
      }
    } catch (error) {
      return 'Error decoding: ' + (error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const copyToClipboard = async () => {
    if (!output) return;
    
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success('Output copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard', { description: humanizeError(error) });
    }
  };

  const swapMode = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    // Swap input and output
    const temp = input;
    setInput(output);
    setOutput(temp);
  };

  // Auto-convert on input change
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      if (mode === 'encode') {
        setOutput(encode(value, encodingType));
      } else {
        setOutput(decode(value, encodingType));
      }
    } else {
      setOutput('');
    }
  };

  const handleEncodingTypeChange = (type: EncodingType) => {
    setEncodingType(type);
    if (input.trim()) {
      if (mode === 'encode') {
        setOutput(encode(input, type));
      } else {
        setOutput(decode(input, type));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          URL Encoder/Decoder
        </CardTitle>
        <CardDescription>
          Encode and decode URLs, query parameters, and Base64 strings. Useful for API debugging and redirect inspection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Encoding Type Selection */}
        <Tabs value={encodingType} onValueChange={(v) => handleEncodingTypeChange(v as EncodingType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="urlComponent">URL Component</TabsTrigger>
            <TabsTrigger value="base64">Base64</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">
              Mode: {mode === 'encode' ? 'Encode' : 'Decode'}
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={swapMode}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Swap
          </Button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <Label htmlFor="encoder-input">
            {mode === 'encode' ? 'Input (Plain Text)' : 'Input (Encoded)'}
          </Label>
          <Textarea
            id="encoder-input"
            placeholder={
              mode === 'encode'
                ? 'Enter text to encode...'
                : 'Enter encoded text to decode...'
            }
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            className="font-mono text-sm min-h-[120px]"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="encoder-output">
              {mode === 'encode' ? 'Output (Encoded)' : 'Output (Plain Text)'}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              disabled={!output}
              className="h-7"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="encoder-output"
            readOnly
            value={output}
            className="font-mono text-sm min-h-[120px] bg-muted"
          />
        </div>

        {/* Examples */}
        <div className="pt-4 border-t space-y-2">
          <Label className="text-sm font-semibold">Examples</Label>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>
              <strong>URL:</strong> Use for full URLs (e.g., https://example.com/path?query=value)
            </div>
            <div>
              <strong>URL Component:</strong> Use for query parameters and path segments (e.g., ?name=John Doe)
            </div>
            <div>
              <strong>Base64:</strong> Use for encoding binary data or strings (e.g., API keys, tokens)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

