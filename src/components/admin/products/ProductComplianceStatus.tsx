/**
 * ProductComplianceStatus - Shows compliance status for a product
 *
 * Displays:
 * - Lab test results (lab name, test date, COA/results links)
 * - Expiration status with warnings
 * - License coverage from compliance documents
 * - Regulatory notes and batch traceability
 * - Link to compliance vault for full details
 *
 * Critical for cannabis industry compliance - every product must be traceable.
 */

import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

import Shield from 'lucide-react/dist/esm/icons/shield';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import FileText from 'lucide-react/dist/esm/icons/file-text';

import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';

import Hash from 'lucide-react/dist/esm/icons/hash';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { Product } from '@/hooks/useProduct';

interface ComplianceDocument {
    id: string;
    name: string;
    document_type: string;
    file_url?: string;
    expiration_date: string | null;
    status: 'active' | 'expired' | 'expiring_soon';
    created_at: string;
}

interface ComplianceStatus {
    overallStatus: 'compliant' | 'warning' | 'critical' | 'unknown';
    labTestStatus: 'valid' | 'missing' | 'expired' | 'expiring_soon';
    licenseStatus: 'valid' | 'missing' | 'expired' | 'expiring_soon';
    issues: ComplianceIssue[];
}

interface ComplianceIssue {
    severity: 'critical' | 'warning' | 'info';
    message: string;
    field?: string;
}

interface ProductComplianceStatusProps {
    product: Product;
}

/**
 * Calculate compliance status based on product data and documents
 */
function calculateComplianceStatus(
    product: Product,
    documents: ComplianceDocument[]
): ComplianceStatus {
    const issues: ComplianceIssue[] = [];
    let labTestStatus: ComplianceStatus['labTestStatus'] = 'valid';
    let licenseStatus: ComplianceStatus['licenseStatus'] = 'valid';

    // Check lab test status
    if (!product.test_date && !product.lab_name && !product.coa_url && !product.lab_results_url) {
        labTestStatus = 'missing';
        issues.push({
            severity: 'critical',
            message: 'No lab test results on file',
            field: 'lab_test',
        });
    } else if (product.test_date) {
        const testDate = new Date(product.test_date);
        const daysSinceTest = differenceInDays(new Date(), testDate);

        // Lab tests typically valid for 1 year (365 days)
        if (daysSinceTest > 365) {
            labTestStatus = 'expired';
            issues.push({
                severity: 'critical',
                message: `Lab test expired (tested ${formatDistanceToNow(testDate, { addSuffix: true })})`,
                field: 'test_date',
            });
        } else if (daysSinceTest > 300) {
            labTestStatus = 'expiring_soon';
            issues.push({
                severity: 'warning',
                message: `Lab test expiring soon (${365 - daysSinceTest} days remaining)`,
                field: 'test_date',
            });
        }
    }

    // Check batch number for traceability
    if (!product.batch_number) {
        issues.push({
            severity: 'warning',
            message: 'No batch number for traceability',
            field: 'batch_number',
        });
    }

    // Check license documents
    const licenseDocuments = documents.filter(doc =>
        doc.document_type.toLowerCase().includes('license') ||
        doc.document_type.toLowerCase().includes('permit')
    );

    if (licenseDocuments.length === 0) {
        licenseStatus = 'missing';
        // This is informational since licenses are at tenant level, not product level
        issues.push({
            severity: 'info',
            message: 'No specific license documents linked',
            field: 'license',
        });
    } else {
        const expiredLicenses = licenseDocuments.filter(doc => doc.status === 'expired');
        const expiringLicenses = licenseDocuments.filter(doc => doc.status === 'expiring_soon');

        if (expiredLicenses.length > 0) {
            licenseStatus = 'expired';
            issues.push({
                severity: 'critical',
                message: `${expiredLicenses.length} ${expiredLicenses.length === 1 ? 'license' : 'licenses'} expired`,
                field: 'license',
            });
        } else if (expiringLicenses.length > 0) {
            licenseStatus = 'expiring_soon';
            issues.push({
                severity: 'warning',
                message: `${expiringLicenses.length} ${expiringLicenses.length === 1 ? 'license' : 'licenses'} expiring soon`,
                field: 'license',
            });
        }
    }

    // Check COA availability
    if (!product.coa_url && !product.coa_pdf_url) {
        issues.push({
            severity: 'warning',
            message: 'Certificate of Analysis (COA) not uploaded',
            field: 'coa',
        });
    }

    // Determine overall status
    let overallStatus: ComplianceStatus['overallStatus'] = 'compliant';
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasWarning = issues.some(i => i.severity === 'warning');

    if (hasCritical) {
        overallStatus = 'critical';
    } else if (hasWarning) {
        overallStatus = 'warning';
    } else if (issues.length === 0 && !product.test_date) {
        overallStatus = 'unknown';
    }

    return {
        overallStatus,
        labTestStatus,
        licenseStatus,
        issues,
    };
}

/**
 * Hook to fetch compliance documents for the tenant
 */
function useComplianceDocuments() {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.compliance.documents(tenant?.id),
        queryFn: async (): Promise<ComplianceDocument[]> => {
            if (!tenant?.id) {
                return [];
            }

            try {
                const { data, error } = await supabase
                    .from('compliance_documents')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .order('expiration_date', { ascending: true });

                if (error && error.code !== '42P01') {
                    logger.error('Failed to fetch compliance documents', error, {
                        component: 'ProductComplianceStatus',
                    });
                    return [];
                }

                return (data ?? []) as ComplianceDocument[];
            } catch {
                return [];
            }
        },
        enabled: !!tenant?.id,
        staleTime: 60_000,
    });
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: ComplianceStatus['overallStatus'] }) {
    switch (status) {
        case 'compliant':
            return (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Compliant
                </Badge>
            );
        case 'warning':
            return (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Attention Needed
                </Badge>
            );
        case 'critical':
            return (
                <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Non-Compliant
                </Badge>
            );
        default:
            return (
                <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unknown
                </Badge>
            );
    }
}

/**
 * Lab test info section
 */
function LabTestSection({ product }: { product: Product }) {
    const hasLabData = product.lab_name || product.test_date || product.coa_url || product.lab_results_url;

    if (!hasLabData) {
        return (
            <div className="p-4 border border-dashed rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <FlaskConical className="h-5 w-5" />
                    <span>No lab test data on file</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Upload lab results to ensure compliance
                </p>
            </div>
        );
    }

    const testDate = product.test_date ? new Date(product.test_date) : null;
    const daysSinceTest = testDate ? differenceInDays(new Date(), testDate) : null;
    const isExpired = daysSinceTest !== null && daysSinceTest > 365;
    const isExpiringSoon = daysSinceTest !== null && daysSinceTest > 300 && daysSinceTest <= 365;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <span className="font-medium">Lab Test Results</span>
                </div>
                {isExpired ? (
                    <Badge variant="destructive">Expired</Badge>
                ) : isExpiringSoon ? (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Expiring Soon
                    </Badge>
                ) : testDate ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Valid
                    </Badge>
                ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-muted-foreground">Lab Name</p>
                    <p className="font-medium">{product.lab_name || '-'}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Test Date</p>
                    <p className={`font-medium ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600' : ''}`}>
                        {testDate ? format(testDate, 'MMM d, yyyy') : '-'}
                    </p>
                    {testDate && (
                        <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(testDate, { addSuffix: true })}
                        </p>
                    )}
                </div>
            </div>

            {/* Document Links */}
            {(product.coa_url || product.coa_pdf_url || product.lab_results_url) && (
                <div className="flex flex-wrap gap-2 pt-2">
                    {(product.coa_url || product.coa_pdf_url) && (
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href={product.coa_url || product.coa_pdf_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <FileText className="h-4 w-4 mr-1" />
                                View COA
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    )}
                    {product.lab_results_url && (
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href={product.lab_results_url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <FlaskConical className="h-4 w-4 mr-1" />
                                Lab Results
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Traceability section
 */
function TraceabilitySection({ product }: { product: Product }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                <span className="font-medium">Traceability</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-muted-foreground">Batch Number</p>
                    <p className="font-medium font-mono">
                        {product.batch_number || (
                            <span className="text-amber-600">Not assigned</span>
                        )}
                    </p>
                </div>
                <div>
                    <p className="text-muted-foreground">SKU</p>
                    <p className="font-medium font-mono">{product.sku || '-'}</p>
                </div>
                {product.barcode && (
                    <div>
                        <p className="text-muted-foreground">Barcode</p>
                        <p className="font-medium font-mono text-xs">{product.barcode}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Compliance issues alert
 */
function ComplianceIssuesAlert({ issues }: { issues: ComplianceIssue[] }) {
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warningIssues = issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length === 0 && warningIssues.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            {criticalIssues.length > 0 && (
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Critical Compliance Issues</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                            {criticalIssues.map((issue, idx) => (
                                <li key={idx}>{issue.message}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
            {warningIssues.length > 0 && (
                <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 dark:text-amber-400">
                        Compliance Warnings
                    </AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                        <ul className="list-disc list-inside mt-1 space-y-1">
                            {warningIssues.map((issue, idx) => (
                                <li key={idx}>{issue.message}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

/**
 * ProductComplianceStatus Component
 */
export function ProductComplianceStatus({ product }: ProductComplianceStatusProps) {
    const { navigateToAdmin } = useTenantNavigation();
    const { data: documents = [], isLoading } = useComplianceDocuments();

    const complianceStatus = useMemo(
        () => calculateComplianceStatus(product, documents),
        [product, documents]
    );

    const handleViewCompliance = () => {
        navigateToAdmin('compliance-vault');
    };

    // Loading state
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Compliance Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={
            complianceStatus.overallStatus === 'critical'
                ? 'border-destructive'
                : complianceStatus.overallStatus === 'warning'
                    ? 'border-amber-500'
                    : ''
        }>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        {complianceStatus.overallStatus === 'critical' ? (
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                        ) : complianceStatus.overallStatus === 'warning' ? (
                            <Shield className="h-5 w-5 text-amber-600" />
                        ) : (
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                        )}
                        Compliance Status
                    </CardTitle>
                    <StatusBadge status={complianceStatus.overallStatus} />
                </div>
                <CardDescription>
                    Lab results, licensing, and regulatory compliance
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Compliance Issues Alert */}
                <ComplianceIssuesAlert issues={complianceStatus.issues} />

                {/* Lab Test Section */}
                <LabTestSection product={product} />

                {/* Traceability Section */}
                <TraceabilitySection product={product} />

                {/* License Documents Summary */}
                {documents.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <span className="font-medium">License Documents</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div className="text-center p-3 bg-muted/50 rounded">
                                <p className="text-2xl font-bold text-green-600">
                                    {documents.filter(d => d.status === 'active').length}
                                </p>
                                <p className="text-xs text-muted-foreground">Active</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded">
                                <p className="text-2xl font-bold text-amber-600">
                                    {documents.filter(d => d.status === 'expiring_soon').length}
                                </p>
                                <p className="text-xs text-muted-foreground">Expiring Soon</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded">
                                <p className="text-2xl font-bold text-destructive">
                                    {documents.filter(d => d.status === 'expired').length}
                                </p>
                                <p className="text-xs text-muted-foreground">Expired</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Link to Compliance Vault */}
                <div className="pt-2 border-t">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleViewCompliance}
                    >
                        <Shield className="h-4 w-4 mr-2" />
                        View Full Compliance Details
                        <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default ProductComplianceStatus;
