# Lodash to Lodash-ES Migration Guide

## Overview

This project has been set up to use `lodash-es` instead of `lodash` for better tree-shaking and smaller bundle sizes. The ES module version allows modern bundlers (like Vite, Webpack 5, Rollup) to eliminate unused code more effectively.

## Benefits of lodash-es

- **Better Tree-Shaking**: ES modules allow bundlers to remove unused functions
- **Smaller Bundle Size**: Only the functions you use are included in the final bundle
- **Modern ES6+ Syntax**: Written with modern JavaScript features
- **Same API**: Fully compatible with lodash - no functional changes needed

## Installation

```bash
npm install lodash-es --save-dev
npm install @types/lodash-es --save-dev
```

## Migration Examples

### Before (lodash)
```typescript
// ❌ Don't do this - imports entire library
import _ from 'lodash';

const result = _.debounce(myFunction, 300);
const chunks = _.chunk(array, 3);
```

### After (lodash-es)
```typescript
// ✅ Do this - imports only what you need
import { debounce, chunk } from 'lodash-es';

const result = debounce(myFunction, 300);
const chunks = chunk(array, 3);
```

## Common Function Migrations

### Debounce
```typescript
// Before
import _ from 'lodash';
const debouncedFn = _.debounce(fn, 300);

// After
import { debounce } from 'lodash-es';
const debouncedFn = debounce(fn, 300);
```

### Throttle
```typescript
// Before
import _ from 'lodash';
const throttledFn = _.throttle(fn, 300);

// After
import { throttle } from 'lodash-es';
const throttledFn = throttle(fn, 300);
```

### Array Operations
```typescript
// Before
import _ from 'lodash';
const unique = _.uniq(array);
const chunks = _.chunk(array, 3);
const sorted = _.sortBy(array, 'property');

// After
import { uniq, chunk, sortBy } from 'lodash-es';
const unique = uniq(array);
const chunks = chunk(array, 3);
const sorted = sortBy(array, 'property');
```

### Object Operations
```typescript
// Before
import _ from 'lodash';
const merged = _.merge(obj1, obj2);
const cloned = _.cloneDeep(obj);
const equal = _.isEqual(obj1, obj2);

// After
import { merge, cloneDeep, isEqual } from 'lodash-es';
const merged = merge(obj1, obj2);
const cloned = cloneDeep(obj);
const equal = isEqual(obj1, obj2);
```

### Collection Operations
```typescript
// Before
import _ from 'lodash';
const grouped = _.groupBy(items, 'type');
const picked = _.pick(obj, ['key1', 'key2']);
const omitted = _.omit(obj, ['key1', 'key2']);

// After
import { groupBy, pick, omit } from 'lodash-es';
const grouped = groupBy(items, 'type');
const picked = pick(obj, ['key1', 'key2']);
const omitted = omit(obj, ['key1', 'key2']);
```

## Utility Helper

A utility file has been created at `src/lib/lodash-utils.ts` that provides:

1. Type-safe wrapper functions for common lodash-es operations
2. Proper TypeScript types
3. Examples of correct import patterns
4. Comprehensive test coverage

You can use these utilities directly:

```typescript
import {
  createDebouncedFunction,
  uniqueArray,
  deepClone
} from '@/lib/lodash-utils';

const debouncedSearch = createDebouncedFunction(search, 300);
const uniqueItems = uniqueArray([1, 2, 2, 3]);
const cloned = deepClone(originalObject);
```

## VSCode Configuration

To get proper IntelliSense for lodash-es, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "types": ["vite/client"]
  }
}
```

## Bundle Size Impact

Using lodash-es with proper tree-shaking can reduce your bundle size significantly:

- Full lodash library: ~70KB (minified)
- Individual lodash-es functions: ~1-5KB each (minified)
- Example: If you only use `debounce`, `throttle`, and `uniq`, you'll save ~60KB

## Testing

Comprehensive tests are available in `src/__tests__/lodash-utils.test.ts` demonstrating:

- All common function patterns
- Edge cases
- TypeScript type safety
- Integration with test utilities

Run tests with:
```bash
npm run test -- src/__tests__/lodash-utils.test.ts
```

## Additional Resources

- [lodash-es NPM Package](https://www.npmjs.com/package/lodash-es)
- [Lodash Documentation](https://lodash.com/docs/)
- [Tree-Shaking Guide](https://webpack.js.org/guides/tree-shaking/)

## Status

✅ lodash-es installed and configured
✅ Utility helpers created with TypeScript support
✅ Comprehensive test suite added
✅ All tests passing
✅ Linting passing
✅ Ready for use in the project

## Notes

This project currently does not have direct lodash dependencies, but lodash-es has been added as a dev dependency for future use. The utility file and tests serve as a reference implementation and can be used whenever lodash functionality is needed in the project.
