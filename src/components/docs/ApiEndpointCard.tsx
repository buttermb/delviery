import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  title: string;
  description: string;
  auth: boolean;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBody?: string;
  responseExample?: string;
  curlExample?: string;
}

interface ApiEndpointCardProps {
  endpoint: ApiEndpoint;
}

export function ApiEndpointCard({ endpoint }: ApiEndpointCardProps) {
  const [activeTab, setActiveTab] = useState<"curl" | "js" | "python">("curl");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const methodColors = {
    GET: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    POST: "bg-green-500/10 text-green-500 border-green-500/20",
    PUT: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    DELETE: "bg-destructive/10 text-destructive border-destructive/20",
    PATCH: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const jsExample = endpoint.curlExample
    ? `const response = await fetch('${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json',
    ${endpoint.auth ? "'Authorization': 'Bearer YOUR_TOKEN'," : ""}
  },${endpoint.requestBody ? `\n  body: JSON.stringify(${endpoint.requestBody}),` : ""}
});
const data = await response.json();`
    : "";

  const pythonExample = endpoint.curlExample
    ? `import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${endpoint.path}',
    headers={
        'Content-Type': 'application/json',
        ${endpoint.auth ? "'Authorization': 'Bearer YOUR_TOKEN'," : ""}
    }${endpoint.requestBody ? `,\n    json=${endpoint.requestBody}` : ""}
)
data = response.json()`
    : "";

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge className={methodColors[endpoint.method]} variant="outline">
                {endpoint.method}
              </Badge>
              <code className="text-sm text-muted-foreground font-mono">{endpoint.path}</code>
            </div>
            <CardTitle className="text-xl">{endpoint.title}</CardTitle>
            <CardDescription className="mt-2">{endpoint.description}</CardDescription>
          </div>
          {endpoint.auth && (
            <Badge variant="secondary" className="shrink-0">
              Requires Auth
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {endpoint.parameters && endpoint.parameters.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-foreground">Parameters</h4>
            <div className="space-y-2">
              {endpoint.parameters.map((param) => (
                <div key={param.name} className="flex gap-3 text-sm">
                  <code className="text-primary font-mono">{param.name}</code>
                  <span className="text-muted-foreground">{param.type}</span>
                  {param.required && (
                    <Badge variant="outline" className="h-5 text-xs">
                      Required
                    </Badge>
                  )}
                  <span className="text-muted-foreground flex-1">{param.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(endpoint.curlExample || endpoint.requestBody) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-foreground">Code Example</h4>
              <div className="flex gap-2">
                {(["curl", "js", "python"] as const).map((lang) => (
                  <Button
                    key={lang}
                    variant={activeTab === lang ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab(lang)}
                  >
                    {lang === "js" ? "JavaScript" : lang === "curl" ? "cURL" : "Python"}
                  </Button>
                ))}
              </div>
            </div>

            {activeTab === "curl" && endpoint.curlExample && (
              <div className="relative">
                <CodeBlock code={endpoint.curlExample} language="bash" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(endpoint.curlExample!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            {activeTab === "js" && jsExample && (
              <div className="relative">
                <CodeBlock code={jsExample} language="javascript" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(jsExample)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            {activeTab === "python" && pythonExample && (
              <div className="relative">
                <CodeBlock code={pythonExample} language="python" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(pythonExample)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {endpoint.responseExample && (
          <div>
            <h4 className="font-semibold mb-3 text-foreground">Response Example</h4>
            <CodeBlock code={endpoint.responseExample} language="json" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
