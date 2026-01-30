import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { handleError } from '@/utils/errorHandling/handlers';

/**
 * Category row from the database
 */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  tenant_id: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Category with children for hierarchical display
 */
export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

/**
 * Flattened category for select options
 */
export interface FlattenedCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  depth: number;
  path: string; // Full path like "Flower > Indica"
}

/**
 * Build a hierarchical tree from flat categories
 */
function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const categoryMap = new Map<string, CategoryNode>();
  const rootCategories: CategoryNode[] = [];

  // First pass: create map of all categories with children array
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [], depth: 0 });
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id);
    if (!node) return;

    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      const parent = categoryMap.get(cat.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      rootCategories.push(node);
    }
  });

  // Sort children alphabetically at each level
  const sortChildren = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortChildren(node.children));
  };
  sortChildren(rootCategories);

  return rootCategories;
}

/**
 * Flatten category tree for use in select dropdowns
 * Creates path strings like "Flower > Indica > OG Kush"
 */
function flattenCategoryTree(
  nodes: CategoryNode[],
  parentPath = ''
): FlattenedCategory[] {
  const result: FlattenedCategory[] = [];

  nodes.forEach((node) => {
    const path = parentPath ? `${parentPath} > ${node.name}` : node.name;

    result.push({
      id: node.id,
      name: node.name,
      description: node.description,
      parentId: node.parent_id,
      depth: node.depth,
      path,
    });

    // Recursively flatten children
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, path));
    }
  });

  return result;
}

/**
 * Group flattened categories by their root parent for grouped select
 */
function groupCategoriesByRoot(
  tree: CategoryNode[],
  flatCategories: FlattenedCategory[]
): { label: string; options: FlattenedCategory[] }[] {
  const groups: { label: string; options: FlattenedCategory[] }[] = [];

  // Create a group for each root category
  tree.forEach((rootNode) => {
    const groupOptions: FlattenedCategory[] = [];

    // Add the root itself
    const rootFlat = flatCategories.find((f) => f.id === rootNode.id);
    if (rootFlat) {
      groupOptions.push(rootFlat);
    }

    // Add all descendants
    const addDescendants = (node: CategoryNode) => {
      node.children.forEach((child) => {
        const childFlat = flatCategories.find((f) => f.id === child.id);
        if (childFlat) {
          groupOptions.push(childFlat);
        }
        addDescendants(child);
      });
    };
    addDescendants(rootNode);

    if (groupOptions.length > 0) {
      groups.push({
        label: rootNode.name,
        options: groupOptions,
      });
    }
  });

  return groups;
}

interface UseCategoriesOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching and working with hierarchical categories
 *
 * @param tenantId - The tenant ID to filter categories by
 * @param options - Query options
 * @returns Categories in various formats for different use cases
 *
 * @example
 * const { categories, tree, flattened, grouped, isLoading } = useCategories(tenantId);
 *
 * // Use `grouped` for ProductCategorySelect component
 * // Use `tree` for rendering a visual hierarchy
 * // Use `flattened` for simple iteration
 */
export function useCategories(
  tenantId: string | undefined,
  options: UseCategoriesOptions = {}
) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: queryKeys.categories.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        // Handle missing table gracefully
        if (error.code === '42P01') {
          return [];
        }
        handleError(error, {
          component: 'useCategories',
          toastTitle: 'Failed to load categories',
        });
        throw error;
      }

      return (data || []) as Category[];
    },
    enabled: enabled && !!tenantId,
  });

  // Build derived data structures
  const tree = useMemo(() => {
    if (!query.data) return [];
    return buildCategoryTree(query.data);
  }, [query.data]);

  const flattened = useMemo(() => {
    return flattenCategoryTree(tree);
  }, [tree]);

  const grouped = useMemo(() => {
    return groupCategoriesByRoot(tree, flattened);
  }, [tree, flattened]);

  // Find a category by ID
  const getCategoryById = (id: string): Category | undefined => {
    return query.data?.find((cat) => cat.id === id);
  };

  // Get the full path for a category ID
  const getCategoryPath = (id: string): string => {
    const flat = flattened.find((f) => f.id === id);
    return flat?.path || '';
  };

  // Get all ancestor IDs for a category
  const getAncestorIds = (id: string): string[] => {
    const ancestors: string[] = [];
    let current = query.data?.find((cat) => cat.id === id);

    while (current?.parent_id) {
      ancestors.push(current.parent_id);
      current = query.data?.find((cat) => cat.id === current?.parent_id);
    }

    return ancestors;
  };

  // Get all descendant IDs for a category
  const getDescendantIds = (id: string): string[] => {
    const descendants: string[] = [];

    const collectDescendants = (parentId: string) => {
      query.data?.forEach((cat) => {
        if (cat.parent_id === parentId) {
          descendants.push(cat.id);
          collectDescendants(cat.id);
        }
      });
    };

    collectDescendants(id);
    return descendants;
  };

  return {
    // Raw data
    categories: query.data || [],

    // Hierarchical structures
    tree,
    flattened,
    grouped,

    // Query state
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,

    // Utility functions
    getCategoryById,
    getCategoryPath,
    getAncestorIds,
    getDescendantIds,

    // Refetch
    refetch: query.refetch,
  };
}
