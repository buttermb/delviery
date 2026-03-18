/**
 * JWT Decoder Tool
 * Decode and inspect JWT tokens
 */

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, AlertCircle, Clock, User, Building2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { getTokenExpiration } from '@/lib/auth/jwt';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface DecodedToken {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  isValid: boolean;
  expiration: Date | null;
  isExpired: boolean;
}

interface TokenInfo {
  name: string;
  token: string | null;
  icon: typeof User;
}

export function JWTDecoder() {
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [currentTokens, setCurrentTokens] = useState<TokenInfo[]>([]);

  // Load tokens from localStorage after mount (client-side only)
  useEffect(() => {
    const tokens: TokenInfo[] = [];
    
    try {
      const customerToken = localStorage.getItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
      const tenantAdminAccessToken = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
      const superAdminToken = localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN);
      
      if (customerToken) {
        tokens.push({ name: 'Customer Token', token: customerToken, icon: User });
      }
      if (tenantAdminAccessToken) {
        tokens.push({ name: 'Tenant Admin Token', token: tenantAdminAccessToken, icon: Building2 });
      }
      if (superAdminToken) {
        tokens.push({ name: 'Super Admin Token', token: superAdminToken, icon: Shield });
      }
      
      setCurrentTokens(tokens);
    } catch {
      // localStorage might not be available (SSR, private browsing, etc.)
      setCurrentTokens([]);
    }
  }, []);

  const decodedToken: DecodedToken | null = useMemo(() => {
    if (!token.trim()) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return {
          header: {},
          payload: {},
          signature: '',
          isValid: false,
          expiration: null,
          isExpired: false,
        };
      }

      // Base64URL decode
      const base64UrlDecode = (str: string): string => {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return atob(str);
      };

      const header = JSON.parse(base64UrlDecode(parts[0]));
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      const expiration = getTokenExpiration(token);
      const isExpired = expiration ? expiration < new Date() : false;

      return {
        header,
        payload,
        signature: parts[2],
        isValid: true,
        expiration,
        isExpired,
      };
    } catch {
      return {
        header: {},
        payload: {},
        signature: '',
        isValid: false,
        expiration: null,
        isExpired: false,
      };
    }
  }, [token]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard', { description: humanizeError(error) });
    }
  };

  const loadToken = (tokenToLoad: string) => {
    setToken(tokenToLoad);
  };

  if (!import.meta.env.DEV) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        Development only — this tool is not available in production.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          JWT Decoder
        </CardTitle>
        <CardDescription>
          Decode and inspect JWT tokens. Paste a token or use one of your current session tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tokens */}
        {currentTokens.length > 0 && (
          <div className="space-y-2">
            <Label>Current Session Tokens</Label>
            <div className="flex flex-wrap gap-2">
              {currentTokens.map(({ name, token: tokenValue, icon: Icon }) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => tokenValue && loadToken(tokenValue)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Token Input */}
        <div className="space-y-2">
          <Label htmlFor="jwt-token">JWT Token</Label>
          <Textarea
            id="jwt-token"
            placeholder="Paste JWT token here (header.payload.signature)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-sm min-h-[100px]"
          />
        </div>

        {/* Decoded Results */}
        {decodedToken && token.trim() && (
          <div className="space-y-4">
            {/* Validation Status */}
            <div className="flex items-center gap-2">
              {decodedToken.isValid ? (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Valid Token
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Invalid Token
                </Badge>
              )}
              {decodedToken.isExpired && (
                <Badge variant="destructive" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Expired
                </Badge>
              )}
              {decodedToken.expiration && !decodedToken.isExpired && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Expires: {decodedToken.expiration.toLocaleString()}
                </Badge>
              )}
            </div>

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Header</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(decodedToken.header, null, 2), 'Header')}
                  className="h-7"
                >
                  {copied === 'Header' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto font-mono">
                {JSON.stringify(decodedToken.header, null, 2)}
              </pre>
            </div>

            {/* Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payload</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(decodedToken.payload, null, 2), 'Payload')}
                  className="h-7"
                >
                  {copied === 'Payload' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto font-mono">
                {JSON.stringify(decodedToken.payload, null, 2)}
              </pre>
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Signature</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(decodedToken.signature, 'Signature')}
                  className="h-7"
                >
                  {copied === 'Signature' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="bg-muted p-3 rounded-md text-xs font-mono break-all">
                {decodedToken.signature}
              </div>
            </div>
          </div>
        )}

        {token.trim() && !decodedToken?.isValid && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Invalid token format. JWT tokens should have 3 parts separated by dots.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

