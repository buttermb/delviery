/**
 * Retry Configuration Form
 * Configure retry behavior for workflows
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface RetryConfig {
  max_attempts: number;
  initial_delay_seconds: number;
  max_delay_seconds: number;
  backoff_multiplier: number;
  retry_on_errors: string[];
}

interface RetryConfigFormProps {
  config: RetryConfig;
  onChange: (config: RetryConfig) => void;
}

const ERROR_TYPES = [
  { value: 'timeout', label: 'Timeout' },
  { value: 'network_error', label: 'Network Error' },
  { value: 'rate_limit', label: 'Rate Limit' },
  { value: 'server_error', label: 'Server Error (5xx)' },
  { value: 'database_error', label: 'Database Error' },
];

export function RetryConfigForm({ config, onChange }: RetryConfigFormProps) {
  const handleErrorTypeToggle = (errorType: string) => {
    const newErrors = config.retry_on_errors.includes(errorType)
      ? config.retry_on_errors.filter(e => e !== errorType)
      : [...config.retry_on_errors, errorType];
    
    onChange({ ...config, retry_on_errors: newErrors });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retry Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_attempts">Max Retry Attempts</Label>
            <Input
              id="max_attempts"
              type="number"
              min="1"
              max="10"
              value={config.max_attempts}
              onChange={(e) => onChange({ ...config, max_attempts: parseInt(e.target.value) || 1 })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of times to retry before moving to dead letter queue
            </p>
          </div>

          <div>
            <Label htmlFor="initial_delay">Initial Delay (seconds)</Label>
            <Input
              id="initial_delay"
              type="number"
              min="1"
              value={config.initial_delay_seconds}
              onChange={(e) => onChange({ ...config, initial_delay_seconds: parseInt(e.target.value) || 5 })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Starting delay before first retry
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_delay">Max Delay (seconds)</Label>
            <Input
              id="max_delay"
              type="number"
              min="1"
              value={config.max_delay_seconds}
              onChange={(e) => onChange({ ...config, max_delay_seconds: parseInt(e.target.value) || 300 })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum delay cap for exponential backoff
            </p>
          </div>

          <div>
            <Label htmlFor="backoff_multiplier">Backoff Multiplier</Label>
            <Input
              id="backoff_multiplier"
              type="number"
              min="1"
              step="0.1"
              value={config.backoff_multiplier}
              onChange={(e) => onChange({ ...config, backoff_multiplier: parseFloat(e.target.value) || 2 })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Multiplier for exponential backoff (2 = double each time)
            </p>
          </div>
        </div>

        <div>
          <Label>Retry On Error Types</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {ERROR_TYPES.map((type) => (
              <Badge
                key={type.value}
                variant={config.retry_on_errors.includes(type.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleErrorTypeToggle(type.value)}
              >
                {type.label}
                {config.retry_on_errors.includes(type.value) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Select which error types should trigger automatic retries
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Retry Behavior Preview</h4>
          <div className="space-y-1 text-xs">
            {Array.from({ length: config.max_attempts }, (_, i) => i + 1).map((attempt) => {
              const delay = Math.min(
                config.initial_delay_seconds * Math.pow(config.backoff_multiplier, attempt - 1),
                config.max_delay_seconds
              );
              return (
                <div key={attempt} className="flex justify-between">
                  <span>Attempt {attempt}:</span>
                  <span>{delay.toFixed(1)}s delay</span>
                </div>
              );
            })}
            <div className="pt-2 border-t mt-2">
              <span className="text-destructive">→ Dead Letter Queue if all retries fail</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
