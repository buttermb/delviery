/**
 * Categories Hook
 *
 * Provides hierarchical category management for products including:
 * - Fetching categories as a tree structure
 * - Flattened list with depth for select inputs
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { STATIC_QUERY_CONFIG } from '@/lib/react-query-config';
import { logger } from '@/lib/logger';

// Types
export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth: number;
}

export interface FlattenedCategory extends Category {
  depth: number;
  path: string;
}

/**
 * Build a tree structure from flat categories array
 */
function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // First pass: create map of all categories with children array
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [], depth: 0 });
  });

  // Second pass: build tree structure and calculate depths
  categories.forEach((cat) => {
    const category = categoryMap.get(cat.id);
    if (!category) return;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        category.depth = parent.depth + 1;
        parent.children.push(category);
      } else {
        rootCategories.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  // Sort children at each level alphabetically
  const sortChildren = (nodes: CategoryTreeNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootCategories);

  return rootCategories;
}

/**
 * Flatten tree into an array with depth info (for select inputs)
 */
function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  parentPath: string = ''
): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];

  nodes.forEach((node) => {
    const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
    result.push({
      id: node.id,
      tenant_id: node.tenant_id,
      name: node.name,
      description: node.description,
      parent_id: node.parent_id,
      created_at: node.created_at,
      updated_at: node.updated_at,
      depth: node.depth,
      path,
    });

    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, path));
    }
  });

  return result;
}

/**
 * Hook to fetch all categories for the current tenant
 */
export function useCategories() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.categories.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('categories')
        .select('id, tenant_id, name, description, parent_id, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true });

      // Gracefully handle missing table
      if (error && error.code === '42P01') {
        logger.warn('Categories table does not exist', { error });
        return [];
      }

      if (error) {
        logger.error('Failed to fetch categories', { error });
        throw error;
      }

      return (data ?? []) as Category[];
    },
    enabled: !!tenant?.id,
    ...STATIC_QUERY_CONFIG,
  });
}

/**
 * Hook to get categories as a hierarchical tree
 */
export function useCategoryTree() {
  const { data: categories, ...rest } = useCategories();

  return {
    ...rest,
    data: categories ? buildCategoryTree(categories) : [],
    categories,
  };
}

/**
 * Hook to get flattened categories with depth (for select inputs)
 */
export function useFlattenedCategories() {
  const { data: tree, categories, ...rest } = useCategoryTree();

  return {
    ...rest,
    data: tree ? flattenCategoryTree(tree) : [],
    categories,
    tree,
  };
}
