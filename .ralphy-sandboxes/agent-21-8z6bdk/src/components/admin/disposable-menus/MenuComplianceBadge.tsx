/**
 * MenuComplianceBadge Component
 *
 * Displays required compliance information for cannabis products on menus.
 * Shows license number, lab test badges, THC/CBD content.
 * Configurable per tenant's jurisdiction requirements.
 * Non-compliant products are flagged.
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatSmartDate } from '@/lib/formatters';
import Award from 'lucide-react/dist/esm/icons/award';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';
import FileCheck from 'lucide-react/dist/esm/icons/file-check';

export interface ProductComplianceData {
  id: string;
  name: string;
  thc_content?: number | null;
  thc_percent?: number | null;
  cbd_content?: number | null;
  cbd_percent?: number | null;
  lab_name?: string | null;
  lab_results_url?: string | null;
  test_date?: string | null;
  coa_url?: string | null;
  coa_pdf_url?: string | null;
  batch_number?: string | null;
  vendor_name?: string | null;
}

export interface JurisdictionRequirements {
  requireLabTest: boolean;
  requireCOA: boolean;
  requireBatchNumber: boolean;
  requireThcDisplay: boolean;
  requireCbdDisplay: boolean;
  maxThcPercent?: number;
  requireTestDate: boolean;
  testExpirationDays?: number;
}

interface MenuComplianceBadgeProps {
  product: ProductComplianceData;
  jurisdiction?: JurisdictionRequirements;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

// Default jurisdiction requirements for cannabis
const DEFAULT_JURISDICTION: JurisdictionRequirements = {
  requireLabTest: true,
  requireCOA: true,
  requireBatchNumber: true,
  requireThcDisplay: true,
  requireCbdDisplay: false,
  requireTestDate: true,
  testExpirationDays: 365,
};

interface ComplianceCheck {
  name: string;
  passed: boolean;
  required: boolean;
  message: string;
}

function checkTestExpiration(testDate: string | null | undefined, expirationDays?: number): boolean {
  if (!testDate || !expirationDays) return true;
  const testDateObj = new Date(testDate);
  const expirationDate = new Date(testDateObj);
  expirationDate.setDate(expirationDate.getDate() + expirationDays);
  return new Date() <= expirationDate;
}

export function MenuComplianceBadge({
  product,
  jurisdiction = DEFAULT_JURISDICTION,
  size = 'md',
  showDetails = false,
  className,
}: MenuComplianceBadgeProps) {
  const complianceChecks = useMemo<ComplianceCheck[]>(() => {
    const checks: ComplianceCheck[] = [];

    // Lab test check
    if (jurisdiction.requireLabTest) {
      const hasLabTest = Boolean(product.lab_name || product.lab_results_url);
      checks.push({
        name: 'Lab Tested',
        passed: hasLabTest,
        required: true,
        message: hasLabTest
          ? `Tested by ${product.lab_name || 'verified lab'}`
          : 'Lab test required',
      });
    }

    // COA check
    if (jurisdiction.requireCOA) {
      const hasCOA = Boolean(product.coa_url || product.coa_pdf_url);
      checks.push({
        name: 'COA Available',
        passed: hasCOA,
        required: true,
        message: hasCOA ? 'Certificate of Analysis available' : 'COA required',
      });
    }

    // Batch number check
    if (jurisdiction.requireBatchNumber) {
      const hasBatch = Boolean(product.batch_number);
      checks.push({
        name: 'Batch Tracked',
        passed: hasBatch,
        required: true,
        message: hasBatch
          ? `Batch: ${product.batch_number}`
          : 'Batch number required',
      });
    }

    // Test date check
    if (jurisdiction.requireTestDate) {
      const hasTestDate = Boolean(product.test_date);
      const isExpired = !checkTestExpiration(product.test_date, jurisdiction.testExpirationDays);
      checks.push({
        name: 'Test Current',
        passed: hasTestDate && !isExpired,
        required: true,
        message: !hasTestDate
          ? 'Test date required'
          : isExpired
            ? 'Lab test expired'
            : `Tested: ${formatSmartDate(product.test_date!)}`,
      });
    }

    // THC content check
    if (jurisdiction.requireThcDisplay) {
      const thcValue = product.thc_content ?? product.thc_percent;
      const hasThc = thcValue != null;
      const exceedsMax = jurisdiction.maxThcPercent !== undefined &&
        hasThc &&
        thcValue > jurisdiction.maxThcPercent;

      checks.push({
        name: 'THC Displayed',
        passed: hasThc && !exceedsMax,
        required: true,
        message: !hasThc
          ? 'THC content required'
          : exceedsMax
            ? `THC ${thcValue}% exceeds max ${jurisdiction.maxThcPercent}%`
            : `THC: ${thcValue}%`,
      });
    }

    // CBD content check (optional in most jurisdictions)
    if (jurisdiction.requireCbdDisplay) {
      const cbdValue = product.cbd_content ?? product.cbd_percent;
      const hasCbd = cbdValue != null;
      checks.push({
        name: 'CBD Displayed',
        passed: hasCbd,
        required: true,
        message: hasCbd ? `CBD: ${cbdValue}%` : 'CBD content required',
      });
    }

    return checks;
  }, [product, jurisdiction]);

  const { isCompliant, requiredFailures, passedCount, totalRequired } = useMemo(() => {
    const required = complianceChecks.filter(c => c.required);
    const passed = required.filter(c => c.passed);
    const failures = required.filter(c => !c.passed);

    return {
      isCompliant: failures.length === 0,
      requiredFailures: failures,
      passedCount: passed.length,
      totalRequired: required.length,
    };
  }, [complianceChecks]);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-2.5 py-1 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  // Main compliance status badge
  const ComplianceSummaryBadge = (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        'font-medium flex items-center',
        isCompliant
          ? 'bg-success/10 text-success border-success/20'
          : 'bg-warning/10 text-warning border-warning/20',
        className
      )}
    >
      {isCompliant ? (
        <ShieldCheck className={iconSizes[size]} />
      ) : (
        <ShieldAlert className={iconSizes[size]} />
      )}
      <span>{isCompliant ? 'Compliant' : `${requiredFailures.length} Issue${requiredFailures.length > 1 ? 's' : ''}`}</span>
    </Badge>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {ComplianceSummaryBadge}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">
                {isCompliant ? 'All compliance checks passed' : 'Compliance issues found'}
              </p>
              <p className="text-xs text-muted-foreground">
                {passedCount}/{totalRequired} requirements met
              </p>
              {!isCompliant && (
                <ul className="text-xs mt-1">
                  {requiredFailures.map((check) => (
                    <li key={check.name} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      {check.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view with all badges
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {/* Lab Test Badge */}
      {jurisdiction.requireLabTest && (
        <Badge
          variant="outline"
          className={cn(
            sizeClasses[size],
            'flex items-center',
            complianceChecks.find(c => c.name === 'Lab Tested')?.passed
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          )}
        >
          <FlaskConical className={iconSizes[size]} />
          <span>Lab Tested</span>
        </Badge>
      )}

      {/* COA Badge */}
      {jurisdiction.requireCOA && complianceChecks.find(c => c.name === 'COA Available')?.passed && (
        <Badge
          variant="outline"
          className={cn(
            sizeClasses[size],
            'flex items-center bg-info/10 text-info border-info/20'
          )}
        >
          <FileCheck className={iconSizes[size]} />
          <span>COA</span>
        </Badge>
      )}

      {/* THC Content */}
      {jurisdiction.requireThcDisplay && (
        <Badge
          variant="secondary"
          className={cn(sizeClasses[size], 'flex items-center')}
        >
          <span>THC {(product.thc_content ?? product.thc_percent ?? 0).toFixed(1)}%</span>
        </Badge>
      )}

      {/* CBD Content */}
      {(jurisdiction.requireCbdDisplay || (product.cbd_content ?? product.cbd_percent)) && (
        <Badge
          variant="secondary"
          className={cn(sizeClasses[size], 'flex items-center')}
        >
          <span>CBD {(product.cbd_content ?? product.cbd_percent ?? 0).toFixed(1)}%</span>
        </Badge>
      )}

      {/* Batch Number */}
      {product.batch_number && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(sizeClasses[size], 'flex items-center')}
              >
                <Award className={iconSizes[size]} />
                <span>Batch</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Batch: {product.batch_number}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Compliance Status */}
      {!isCompliant && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  sizeClasses[size],
                  'flex items-center bg-warning/10 text-warning border-warning/20'
                )}
              >
                <AlertTriangle className={iconSizes[size]} />
                <span>{requiredFailures.length} Issue{requiredFailures.length > 1 ? 's' : ''}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <ul className="text-xs space-y-1">
                {requiredFailures.map((check) => (
                  <li key={check.name}>{check.message}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isCompliant && (
        <Badge
          variant="outline"
          className={cn(
            sizeClasses[size],
            'flex items-center bg-success/10 text-success border-success/20'
          )}
        >
          <CheckCircle className={iconSizes[size]} />
          <span>Verified</span>
        </Badge>
      )}
    </div>
  );
}

/**
 * Helper function to check if a product meets compliance requirements
 */
export function isProductCompliant(
  product: ProductComplianceData,
  jurisdiction: JurisdictionRequirements = DEFAULT_JURISDICTION
): boolean {
  if (jurisdiction.requireLabTest && !product.lab_name && !product.lab_results_url) {
    return false;
  }

  if (jurisdiction.requireCOA && !product.coa_url && !product.coa_pdf_url) {
    return false;
  }

  if (jurisdiction.requireBatchNumber && !product.batch_number) {
    return false;
  }

  if (jurisdiction.requireTestDate) {
    if (!product.test_date) return false;
    if (!checkTestExpiration(product.test_date, jurisdiction.testExpirationDays)) {
      return false;
    }
  }

  if (jurisdiction.requireThcDisplay) {
    const thcValue = product.thc_content ?? product.thc_percent;
    if (thcValue === null || thcValue === undefined) return false;
    if (jurisdiction.maxThcPercent !== undefined && thcValue > jurisdiction.maxThcPercent) {
      return false;
    }
  }

  if (jurisdiction.requireCbdDisplay) {
    const cbdValue = product.cbd_content ?? product.cbd_percent;
    if (cbdValue === null || cbdValue === undefined) return false;
  }

  return true;
}

/**
 * Get compliance issues for a product
 */
export function getComplianceIssues(
  product: ProductComplianceData,
  jurisdiction: JurisdictionRequirements = DEFAULT_JURISDICTION
): string[] {
  const issues: string[] = [];

  if (jurisdiction.requireLabTest && !product.lab_name && !product.lab_results_url) {
    issues.push('Lab test results required');
  }

  if (jurisdiction.requireCOA && !product.coa_url && !product.coa_pdf_url) {
    issues.push('Certificate of Analysis (COA) required');
  }

  if (jurisdiction.requireBatchNumber && !product.batch_number) {
    issues.push('Batch number required');
  }

  if (jurisdiction.requireTestDate) {
    if (!product.test_date) {
      issues.push('Test date required');
    } else if (!checkTestExpiration(product.test_date, jurisdiction.testExpirationDays)) {
      issues.push('Lab test has expired');
    }
  }

  if (jurisdiction.requireThcDisplay) {
    const thcValue = product.thc_content ?? product.thc_percent;
    if (thcValue === null || thcValue === undefined) {
      issues.push('THC content must be displayed');
    } else if (jurisdiction.maxThcPercent !== undefined && thcValue > jurisdiction.maxThcPercent) {
      issues.push(`THC content exceeds maximum allowed (${jurisdiction.maxThcPercent}%)`);
    }
  }

  if (jurisdiction.requireCbdDisplay) {
    const cbdValue = product.cbd_content ?? product.cbd_percent;
    if (cbdValue === null || cbdValue === undefined) {
      issues.push('CBD content must be displayed');
    }
  }

  return issues;
}

export default MenuComplianceBadge;
