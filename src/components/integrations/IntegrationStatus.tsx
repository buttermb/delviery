import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { humanizeError } from '@/lib/humanizeError';
import { format } from "date-fns/format";

interface IntegrationStatusProps {
    name: string;
    description?: string;
    status: "connected" | "disconnected" | "error" | "checking";
    lastSync?: Date | string | null;
    error?: string;
    onTest?: () => Promise<void>;
    testButtonLabel?: string;
}

export function IntegrationStatus({
    name,
    description,
    status,
    lastSync,
    error,
    onTest,
    testButtonLabel = "Test Connection",
}: IntegrationStatusProps) {
    const [testing, setTesting] = useState(false);
    const { toast } = useToast();

    const handleTest = async () => {
        if (!onTest) return;

        setTesting(true);
        try {
            await onTest();
            toast({
                title: "Test successful",
                description: `${name} connection is working correctly.`,
            });
        } catch (error: unknown) {
            toast({
                title: "Test failed",
                description: humanizeError(error, `Failed to connect to ${name}.`),
                variant: "destructive",
            });
        } finally {
            setTesting(false);
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case "connected":
                return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case "disconnected":
                return <XCircle className="h-5 w-5 text-gray-400" />;
            case "error":
                return <AlertCircle className="h-5 w-5 text-destructive" />;
            case "checking":
                return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case "connected":
                return <Badge variant="outline" className="border-green-600 text-green-600">Connected</Badge>;
            case "disconnected":
                return <Badge variant="outline" className="border-gray-400 text-gray-600">Not Connected</Badge>;
            case "error":
                return <Badge variant="destructive">Error</Badge>;
            case "checking":
                return <Badge variant="outline">Checking...</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        {getStatusIcon()}
                        <div>
                            <CardTitle className="text-base">{name}</CardTitle>
                            {description && (
                                <CardDescription className="text-sm mt-1">{description}</CardDescription>
                            )}
                        </div>
                    </div>
                    {getStatusBadge()}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Error message */}
                    {error && status === "error" && (
                        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                            {error}
                        </div>
                    )}

                    {/* Last sync time */}
                    {lastSync && status === "connected" && (
                        <div className="text-xs text-muted-foreground">
                            Last synced: {format(new Date(lastSync), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                    )}

                    {/* Test button */}
                    {onTest && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTest}
                            disabled={testing || status === "checking"}
                            className="w-full sm:w-auto"
                        >
                            {testing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    {testButtonLabel}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
