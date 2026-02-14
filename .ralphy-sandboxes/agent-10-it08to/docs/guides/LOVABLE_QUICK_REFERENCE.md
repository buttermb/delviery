# Lovable Integration Quick Reference

## Quick Links to Main Guide
📖 **Full Guide**: See `LOVABLE_COMPLETE_INTEGRATION_GUIDE.md` for complete details

---

## Feature Routes & Files

| Feature | Route | Page File | Tier |
|---------|-------|-----------|------|
| Suppliers | `/admin/suppliers` | `src/pages/admin/SupplierManagementPage.tsx` | Professional |
| Purchase Orders | `/admin/purchase-orders` | `src/pages/admin/PurchaseOrdersPage.tsx` | Professional |
| Returns | `/admin/returns` | `src/pages/admin/ReturnsManagementPage.tsx` | Professional |
| Loyalty Program | `/admin/loyalty-program` | `src/pages/admin/LoyaltyProgramPage.tsx` | Professional |
| Coupons | `/admin/coupons` | `src/pages/admin/CouponManagementPage.tsx` | Professional |
| Quality Control | `/admin/quality-control` | `src/pages/admin/QualityControlPage.tsx` | Professional |
| Advanced CRM | `/admin/customer-crm` | `src/pages/admin/CustomerCRMPage.tsx` | Professional |
| Marketing Automation | `/admin/marketing-automation` | `src/pages/admin/MarketingAutomationPage.tsx` | Professional |
| Appointments | `/admin/appointments` | `src/pages/admin/AppointmentSchedulerPage.tsx` | Professional |
| Support Tickets | `/admin/support-tickets` | `src/pages/admin/SupportTicketsPage.tsx` | Professional |
| Batch Recall | `/admin/batch-recall` | `src/pages/admin/BatchRecallPage.tsx` | Professional |
| Compliance Vault | `/admin/compliance-vault` | `src/pages/admin/ComplianceVaultPage.tsx` | Professional |
| Advanced Reporting | `/admin/advanced-reporting` | `src/pages/admin/AdvancedReportingPage.tsx` | Professional |
| Vendor Portal | `/vendor/dashboard` | `src/pages/vendor/VendorDashboardPage.tsx` | Professional |
| Predictive Analytics | `/admin/predictive-analytics` | `src/pages/admin/PredictiveAnalyticsPage.tsx` | Professional |

---

## Database Tables Required

### Core Tables (All Features)
1. `suppliers`
2. `purchase_orders` + `purchase_order_items`
3. `return_authorizations` + `return_items`
4. `loyalty_program_config` + `loyalty_rewards` + `loyalty_point_adjustments`
5. `coupons`
6. `quality_control_tests` + `quarantined_inventory`
7. `marketing_campaigns` + `marketing_workflows`
8. `appointments`
9. `support_tickets` + `support_ticket_comments`
10. `batch_recalls` + `recall_notifications`
11. `compliance_documents`
12. `custom_reports` + `scheduled_reports`
13. `vendor_users`

**Total**: 20+ tables

---

## Edge Functions Required

1. `create-purchase-order` - Atomic PO creation
2. `send-campaign` - Email/SMS campaigns
3. `execute-workflow` - Marketing automation
4. `notify-recall` - Recall notifications
5. `generate-recall-report` - Regulatory reports
6. `vendor-auth` - Vendor authentication
7. `predict-demand` - ML forecasting
8. `generate-report` - Custom reports
9. `send-scheduled-report` - Scheduled report delivery

**Total**: 9 edge functions

---

## Storage Buckets Required

1. `compliance-documents` - For compliance document uploads
2. `quality-control` - For COA and test result files

---

## Integration Checklist

### Phase 1: Database
- [ ] Create all tables with proper schema
- [ ] Add RLS policies for all tables
- [ ] Create indexes for performance
- [ ] Add triggers for auto-updates (e.g., compliance status)
- [ ] Test tenant isolation

### Phase 2: Storage
- [ ] Create `compliance-documents` bucket
- [ ] Create `quality-control` bucket
- [ ] Set bucket policies for tenant isolation
- [ ] Test file uploads

### Phase 3: Edge Functions
- [ ] Create all 9 edge functions
- [ ] Deploy functions
- [ ] Test each function
- [ ] Set up cron jobs for scheduled tasks

### Phase 4: Frontend Verification
- [ ] Verify all routes in `App.tsx`
- [ ] Test feature gating
- [ ] Verify query keys
- [ ] Test error handling
- [ ] Test mobile responsiveness

### Phase 5: Testing
- [ ] Run complete testing checklist
- [ ] Test multi-tenant isolation
- [ ] Test feature tier restrictions
- [ ] Test error scenarios
- [ ] Performance testing

---

## Common Patterns

### Data Fetching Pattern
```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.featureName.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("table_name")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (error) throw error;
    return data;
  },
  enabled: !!tenant?.id,
});
```

### Mutation Pattern
```typescript
const mutation = useMutation({
  mutationFn: async (formData) => {
    const { error } = await supabase
      .from("table_name")
      .insert([{
        tenant_id: tenant.id,
        ...formData,
        created_by: admin?.id || null,
      }]);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all() });
    toast.success("Success message");
  },
  onError: (error) => {
    logger.error('Operation failed', error, { component: 'ComponentName' });
    toast.error("Error message");
  },
});
```

### RLS Policy Pattern
```sql
CREATE POLICY "Tenants can manage their data"
  ON table_name FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
```

---

## Key Configuration Files

- `src/lib/featureConfig.ts` - Feature definitions
- `src/lib/queryKeys.ts` - Query key factory
- `src/App.tsx` - Routes
- `src/components/tenant-admin/TenantAdminSidebar.tsx` - Menu
- `src/contexts/TenantAdminAuthContext.tsx` - Auth context

---

## Testing Priority

### High Priority (Core Features)
1. Supplier Management
2. Purchase Orders
3. Returns & Refunds
4. Coupons
5. Support Tickets

### Medium Priority (Operational)
6. Loyalty Program
7. Quality Control
8. Appointments
9. Compliance Vault

### Lower Priority (Advanced)
10. Advanced CRM
11. Marketing Automation
12. Batch Recall
13. Advanced Reporting
14. Vendor Portal
15. Predictive Analytics

---

## Common Issues & Solutions

### Issue: RLS Policy Blocking Queries
**Solution**: Verify `tenant_id` is included in policy and query

### Issue: Feature Not Showing in Sidebar
**Solution**: Check `featureConfig.ts` and `TenantAdminSidebar.tsx`

### Issue: Query Not Fetching Data
**Solution**: Verify `enabled: !!tenant?.id` and tenant context is loaded

### Issue: Mutation Failing
**Solution**: Check RLS policies, verify `tenant_id` in insert, check error logs

### Issue: File Upload Failing
**Solution**: Verify storage bucket exists, check bucket policies, verify file size limits

---

## Support Resources

- **Full Integration Guide**: `LOVABLE_COMPLETE_INTEGRATION_GUIDE.md`
- **Code References**: See guide for detailed code examples
- **Database Schemas**: See guide for complete SQL schemas
- **Edge Functions**: See guide for function specifications

---

## Quick Start Commands

```bash
# Run database migrations
supabase migration up

# Deploy edge functions
supabase functions deploy create-purchase-order
supabase functions deploy send-campaign
# ... (deploy all 9 functions)

# Test locally
npm run dev

# Run linter
npm run lint

# Build for production
npm run build
```

---

**Last Updated**: All features implemented and ready for backend integration.
