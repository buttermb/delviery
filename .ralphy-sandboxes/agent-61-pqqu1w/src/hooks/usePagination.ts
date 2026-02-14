/**
 * Standardized pagination hook
 * Manages page state, items per page, and URL persistence
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UsePaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  persistInUrl?: boolean;
  urlKey?: string;
}

export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
) {
  const {
    defaultPage = 1,
    defaultPageSize = 25,
    pageSizeOptions = [10, 25, 50, 100],
    persistInUrl = true,
    urlKey = 'page',
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial values from URL or defaults
  const getPageFromUrl = () => {
    if (!persistInUrl) return defaultPage;
    const page = searchParams.get(urlKey);
    return page ? parseInt(page, 10) : defaultPage;
  };

  const getPageSizeFromUrl = () => {
    if (!persistInUrl) return defaultPageSize;
    const size = searchParams.get(`${urlKey}Size`);
    return size ? parseInt(size, 10) : defaultPageSize;
  };

  const [currentPage, setCurrentPage] = useState(getPageFromUrl);
  const [pageSize, setPageSize] = useState(getPageSizeFromUrl);

  // Update URL when page/pageSize changes
  useEffect(() => {
    if (persistInUrl) {
      const params = new URLSearchParams(searchParams);
      if (currentPage > 1) {
        params.set(urlKey, currentPage.toString());
      } else {
        params.delete(urlKey);
      }
      if (pageSize !== defaultPageSize) {
        params.set(`${urlKey}Size`, pageSize.toString());
      } else {
        params.delete(`${urlKey}Size`);
      }
      setSearchParams(params, { replace: true });
    }
  }, [currentPage, pageSize, persistInUrl, urlKey, defaultPageSize, searchParams, setSearchParams]);

  // Calculate pagination
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  // Navigation functions
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    // Reset to first page when changing page size
    setCurrentPage(1);
  };

  return {
    // Data - Primary API (matches PRD spec)
    page: currentPage,
    pageSize,
    offset: startIndex,
    totalPages,

    // Setters (matches PRD spec)
    setPage: goToPage,
    setPageSize: changePageSize,

    // Data - Extended API
    paginatedItems,
    currentPage,
    totalItems: items.length,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, items.length),
    pageSizeOptions,

    // Navigation
    goToPage,
    nextPage,
    previousPage,
    changePageSize,

    // State
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
  };
}

