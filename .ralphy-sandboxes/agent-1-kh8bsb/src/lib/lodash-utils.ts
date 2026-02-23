/**
 * Utility functions using lodash-es for better tree-shaking
 *
 * This file demonstrates how to import from lodash-es instead of lodash.
 * Each function is imported individually, allowing bundlers to tree-shake
 * unused functions and reduce bundle size.
 *
 * Migration guide:
 * - Instead of: import _ from 'lodash'
 * - Use: import { debounce, throttle } from 'lodash-es'
 *
 * Benefits:
 * - Better tree-shaking with ES modules
 * - Smaller bundle sizes
 * - Modern ES6+ syntax
 */

import { debounce } from 'lodash-es';
import { throttle } from 'lodash-es';
import { chunk } from 'lodash-es';
import { uniq } from 'lodash-es';
import { groupBy } from 'lodash-es';
import { sortBy } from 'lodash-es';
import { merge } from 'lodash-es';
import { cloneDeep } from 'lodash-es';
import { isEqual } from 'lodash-es';
import { pick } from 'lodash-es';
import { omit } from 'lodash-es';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 */
export const createDebouncedFunction = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ReturnType<typeof debounce> => {
  return debounce(func, wait);
};

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 */
export const createThrottledFunction = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ReturnType<typeof throttle> => {
  return throttle(func, wait);
};

/**
 * Creates an array of elements split into groups the length of size
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  return chunk(array, size);
};

/**
 * Creates a duplicate-free version of an array
 */
export const uniqueArray = <T>(array: T[]): T[] => {
  return uniq(array);
};

/**
 * Groups items by a key
 */
export const groupByKey = <T>(
  array: T[],
  key: ((item: T) => string) | string
): Record<string, T[]> => {
  return groupBy(array, key);
};

/**
 * Sorts array by iteratees
 */
export const sortByKey = <T>(
  array: T[],
  iteratees: ((item: T) => any) | string | Array<((item: T) => any) | string>
): T[] => {
  return sortBy(array, iteratees);
};

/**
 * Deeply merges objects
 */
export const deepMerge = <T extends object>(
  target: T,
  ...sources: Partial<T>[]
): T => {
  return merge({}, target, ...sources);
};

/**
 * Creates a deep clone of value
 */
export const deepClone = <T>(value: T): T => {
  return cloneDeep(value);
};

/**
 * Performs a deep comparison between two values
 */
export const deepEqual = (value1: any, value2: any): boolean => {
  return isEqual(value1, value2);
};

/**
 * Creates an object composed of the picked object properties
 */
export const pickProperties = <T extends object, K extends keyof T>(
  object: T,
  ...keys: K[]
): Pick<T, K> => {
  return pick(object, ...keys) as Pick<T, K>;
};

/**
 * Creates an object composed of properties that are not omitted
 */
export const omitProperties = <T extends object, K extends keyof T>(
  object: T,
  ...keys: K[]
): Omit<T, K> => {
  return omit(object, ...keys) as Omit<T, K>;
};

// Export individual functions for direct import
export { debounce, throttle, chunk, uniq, groupBy, sortBy, merge, cloneDeep, isEqual, pick, omit };
