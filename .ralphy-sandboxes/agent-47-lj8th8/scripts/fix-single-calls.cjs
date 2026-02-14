const fs = require('fs');
const path = require('path');

// List of files still containing .single() from grep search
const filesToFix = [
    'src/pages/WelcomeOnboarding.tsx',
    'src/pages/admin/ProductManagement.tsx',
    'src/pages/admin/Webhooks.tsx',
    'src/pages/admin/WhiteLabel.tsx',
    'src/pages/admin/CustomerInsights.tsx',
    'src/pages/admin/CustomerDetails.tsx',
    'src/pages/super-admin/MarketplaceModerationPage.tsx',
    'src/pages/tenant-admin/marketplace/MessagesPage.tsx',
    'src/pages/tenant-admin/CustomReportsPage.tsx',
    'src/pages/admin/CustomDomain.tsx',
    'src/pages/saas/SuperAdminEnhanced.tsx',
    'src/pages/admin/Compliance.tsx',
    'src/pages/admin/Automation.tsx',
    'src/pages/courier/UnifiedActiveDeliveryPage.tsx',
    'src/pages/courier/ActiveOrderPage.tsx',
    'src/lib/workflowEngine.ts',
    'src/lib/utils/databaseSafety.ts',
    'src/lib/hooks/useEncryptedMutation.ts',
    'src/lib/hooks/useEncryptedQuery.ts',
    'src/lib/demoData.ts',
    'src/contexts/AccountContext.tsx',
    'src/components/admin/EditClientDialog.tsx',
    'src/components/LoyaltyPoints.tsx',
    'src/components/super-admin/ImpersonationMode.tsx',
    'src/components/admin/workflow/WorkflowCanvas.tsx',
    'src/components/reports/ReportBuilder.tsx',
    'src/components/pos/ShiftManager.tsx',
    'src/components/pos/ZReport.tsx',
    'src/components/admin/recall/RecallForm.tsx',
    'src/components/menu/ModernCheckoutFlow.tsx',
    'src/components/admin/purchase-orders/PODetail.tsx',
    'src/components/NotificationPreferences.tsx',
    'src/components/LiveChatWidget.tsx',
    'src/components/admin/loyalty/PointAdjustments.tsx',
    'src/components/admin/inventory/QuickReceiving.tsx',
    'src/components/home/ReviewSection.tsx',
    'src/components/admin/disposable-menus/CloneMenuDialog.tsx',
    'src/components/examples/OptimisticProductForm.tsx',
    'src/components/admin/CreateTenantDialog.tsx',
    'src/components/admin/compliance/ComplianceDashboard.tsx',
    'src/components/crm/CommunicationHistory.tsx',
    'src/components/customer/CourierTracking.tsx',
    'src/hooks/usePrefetchDashboard.ts',
    'src/components/admin/AddRunnerDialog.tsx'
];

const rootDir = 'c:/Users/Alex/Documents/gt/delviery';
let filesProcessed = 0;
let instancesReplaced = 0;

filesToFix.forEach(filePath => {
    const fullPath = path.join(rootDir, filePath);

    try {
        if (fs.existsSync(fullPath)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const originalContent = content;

            // Replace .single() with .maybeSingle()
            content = content.replace(/\.single\(\);/g, '.maybeSingle();');

            if (content !== originalContent) {
                const matches = originalContent.match(/\.single\(\);/g);
                const count = matches ? matches.length : 0;
                instancesReplaced += count;
                filesProcessed++;

                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`✅ ${filePath} (${count} instances)`);
            }
        } else {
            console.log(`⚠️  File not found: ${filePath}`);
        }
    } catch (error) {
        console.log(`❌ Error processing ${filePath}: ${error.message}`);
    }
});

console.log(`\n📊 Summary:`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Instances replaced: ${instancesReplaced}`);
