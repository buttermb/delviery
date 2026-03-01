/**
 * Auto-Tag Rules Hook
 *
 * Provides automatic tagging functionality for customers based on configurable rules.
 * Rules include:
 * - VIP: When customer LTV exceeds threshold (top 10% or custom amount)
 * - Wholesale: When customer_type is 'wholesale'
 * - Preferred: When customer has certain loyalty tier
 * - Flagged: Manual flag for review
 * - At Risk: When customer hasn't ordered in X days
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useTags, useAssignTag } from '@/hooks/useCustomerTags';
import { humanizeError } from '@/lib/humanizeError';

// Predefined tag names for auto-tagging
export const AUTO_TAG_NAMES = {
  VIP: 'vip',
  WHOLESALE: 'wholesale',
  RETAIL: 'retail',
  PREFERRED: 'preferred',
  FLAGGED: 'flagged',
  AT_RISK: 'at_risk',
  SPECIAL_PRICING: 'special_pricing',
  NEW_CUSTOMER: 'new_customer',
} as const;

// Predefined tag colors
export const AUTO_TAG_COLORS: Record<string, string> = {
  [AUTO_TAG_NAMES.VIP]: '#F59E0B', // amber
  [AUTO_TAG_NAMES.WHOLESALE]: '#3B82F6', // blue
  [AUTO_TAG_NAMES.RETAIL]: '#6B7280', // gray
  [AUTO_TAG_NAMES.PREFERRED]: '#22C55E', // green
  [AUTO_TAG_NAMES.FLAGGED]: '#EF4444', // red
  [AUTO_TAG_NAMES.AT_RISK]: '#F97316', // orange
  [AUTO_TAG_NAMES.SPECIAL_PRICING]: '#8B5CF6', // violet
  [AUTO_TAG_NAMES.NEW_CUSTOMER]: '#06B6D4', // cyan
};

export interface AutoTagRule {
  id: string;
  name: string;
  tagName: string;
  condition: 'ltv_threshold' | 'customer_type' | 'loyalty_tier' | 'days_since_order' | 'order_count';
  threshold?: number;
  value?: string;
  enabled: boolean;
}

// Default auto-tag rules
export const DEFAULT_AUTO_TAG_RULES: AutoTagRule[] = [
  {
    id: 'vip-ltv',
    name: 'VIP by LTV',
    tagName: AUTO_TAG_NAMES.VIP,
    condition: 'ltv_threshold',
    threshold: 5000, // $5000 LTV
    enabled: true,
  },
  {
    id: 'wholesale-type',
    name: 'Wholesale Customers',
    tagName: AUTO_TAG_NAMES.WHOLESALE,
    condition: 'customer_type',
    value: 'wholesale',
    enabled: true,
  },
  {
    id: 'at-risk-inactive',
    name: 'At Risk (Inactive)',
    tagName: AUTO_TAG_NAMES.AT_RISK,
    condition: 'days_since_order',
    threshold: 60, // 60 days
    enabled: true,
  },
  {
    id: 'new-customer',
    name: 'New Customers',
    tagName: AUTO_TAG_NAMES.NEW_CUSTOMER,
    condition: 'order_count',
    threshold: 1, // Less than 2 orders
    enabled: true,
  },
];

interface Customer {
  id: string;
  customer_type: string;
  total_spent: number;
  loyalty_tier: string | null;
  last_purchase_at: string | null;
}

/**
 * Hook to get or create auto-tag by name
 */
export function useEnsureAutoTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagName: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Check if tag exists
      const { data: existingTag, error: findError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('tenant_id', tenant.id)
        .eq('name', tagName.toLowerCase())
        .maybeSingle();

      if (findError) {
        logger.error('Failed to find tag', { error: findError, tagName });
        throw findError;
      }

      if (existingTag) {
        return existingTag;
      }

      // Create the tag
      const color = AUTO_TAG_COLORS[tagName] || '#6B7280';
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({
          tenant_id: tenant.id,
          name: tagName.toLowerCase(),
          color,
          description: `Auto-generated tag for ${tagName}`,
        })
        .select('id, name, color')
        .maybeSingle();

      if (createError) {
        logger.error('Failed to create auto-tag', { error: createError, tagName });
        throw createError;
      }

      return newTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to create auto tag'));
    },
  });
}

/**
 * Hook to evaluate and apply auto-tag rules to a customer
 */
export function useApplyAutoTags() {
  const { tenant } = useTenantAdminAuth();
  const ensureAutoTag = useEnsureAutoTag();
  const assignTag = useAssignTag();

  return useMutation({
    mutationFn: async ({
      customer,
      rules = DEFAULT_AUTO_TAG_RULES,
    }: {
      customer: Customer;
      rules?: AutoTagRule[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const appliedTags: string[] = [];

      for (const rule of rules) {
        if (!rule.enabled) continue;

        let shouldApply = false;

        switch (rule.condition) {
          case 'ltv_threshold':
            shouldApply = customer.total_spent >= (rule.threshold ?? 0);
            break;

          case 'customer_type':
            shouldApply = customer.customer_type?.toLowerCase() === rule.value?.toLowerCase();
            break;

          case 'loyalty_tier':
            shouldApply = customer.loyalty_tier?.toLowerCase() === rule.value?.toLowerCase();
            break;

          case 'days_since_order':
            if (customer.last_purchase_at) {
              const daysSince = Math.floor(
                (Date.now() - new Date(customer.last_purchase_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              shouldApply = daysSince >= (rule.threshold ?? 0);
            }
            break;

          case 'order_count':
            // This would need order count data passed in
            break;
        }

        if (shouldApply) {
          try {
            // Ensure tag exists
            const tag = await ensureAutoTag.mutateAsync(rule.tagName);
            if (tag) {
              // Assign tag to customer (will skip if already assigned due to unique constraint)
              try {
                await assignTag.mutateAsync({
                  contactId: customer.id,
                  tagId: tag.id,
                });
                appliedTags.push(rule.tagName);
              } catch (assignError) {
                // Ignore duplicate key errors - tag already assigned
                const errorMessage = assignError instanceof Error ? assignError.message : String(assignError);
                if (!errorMessage.includes('duplicate key')) {
                  throw assignError;
                }
              }
            }
          } catch (error) {
            logger.warn('Failed to apply auto-tag rule', {
              rule: rule.name,
              customerId: customer.id,
              error,
            });
          }
        }
      }

      return appliedTags;
    },
    onSuccess: () => {
      toast.success('Auto tags applied successfully');
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to apply auto tags'));
    },
  });
}

/**
 * Hook to get customers filtered by tags
 */
export function useCustomersByTags(tagIds: string[]) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.customers.all, 'by-tags', tagIds],
    queryFn: async () => {
      if (!tenant?.id || tagIds.length === 0) return [];

      // Get customer IDs that have all selected tags
      const { data, error } = await supabase
        .from('customer_tags')
        .select('contact_id')
        .eq('tenant_id', tenant.id)
        .in('tag_id', tagIds);

      if (error) {
        logger.error('Failed to fetch customers by tags', { error, tagIds });
        throw error;
      }

      // Count occurrences to find customers with ALL tags
      const customerCounts = (data ?? []).reduce((acc: Record<string, number>, item: { contact_id: string }) => {
        acc[item.contact_id] = (acc[item.contact_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Return customer IDs that have all selected tags
      return Object.entries(customerCounts)
        .filter(([_, count]) => count === tagIds.length)
        .map(([customerId]) => customerId);
    },
    enabled: !!tenant?.id && tagIds.length > 0,
    staleTime: 30000,
  });
}

/**
 * Hook to get tag counts (number of customers per tag)
 */
export function useTagCounts() {
  const { tenant } = useTenantAdminAuth();
  const { data: tags } = useTags();

  return useQuery({
    queryKey: [...queryKeys.customerTags.all, 'counts', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return {};

      const { data, error } = await supabase
        .from('customer_tags')
        .select('tag_id')
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to fetch tag counts', { error });
        throw error;
      }

      // Count customers per tag
      const counts = (data ?? []).reduce((acc: Record<string, number>, item: { tag_id: string }) => {
        acc[item.tag_id] = (acc[item.tag_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return counts;
    },
    enabled: !!tenant?.id && !!tags,
    staleTime: 30000,
  });
}
