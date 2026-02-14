# Optimize Command

Analyze code performance and propose concrete optimizations.

## Usage
Run `/optimize [file or component name]` to analyze performance.

## Instructions

### 1. Identify Target
Read the specified file or component to understand its purpose.

### 2. Performance Analysis

#### React Components
- [ ] Unnecessary re-renders (missing useMemo/useCallback)
- [ ] Large component trees that could be split
- [ ] Inline object/array creation in props
- [ ] Missing React.memo for pure components
- [ ] useEffect dependencies causing loops

#### Data Fetching
- [ ] N+1 query patterns
- [ ] Missing query result caching
- [ ] Fetching more data than needed
- [ ] Missing pagination for large datasets
- [ ] Inefficient refetch strategies

#### Database Queries
- [ ] Missing indexes on frequently filtered columns
- [ ] Full table scans
- [ ] Expensive JOINs that could be denormalized
- [ ] Missing LIMIT on unbounded queries

#### Bundle Size
- [ ] Large dependencies that could be lazy loaded
- [ ] Unused imports
- [ ] Missing code splitting for routes

### 3. Measure (if possible)

```typescript
// React Profiler
<Profiler id="ComponentName" onRender={callback}>
  <Component />
</Profiler>

// Performance timing
const start = performance.now();
// ... operation
console.log(`Operation took ${performance.now() - start}ms`);
```

### 4. Propose Optimizations

For each issue found, provide:
1. **Problem**: What's slow and why
2. **Impact**: Estimated improvement
3. **Solution**: Specific code changes
4. **Tradeoffs**: Any downsides to consider

## Output Format

```markdown
## Performance Analysis: [Component/File]

### 🔴 Critical (Significant impact)

#### Issue: [Name]
- **Location**: [File:Line]
- **Problem**: [Description]
- **Solution**: 
\`\`\`typescript
// Before
const items = data.filter(x => x.active).map(x => x.name);

// After (combined pass)
const items = data.reduce((acc, x) => {
  if (x.active) acc.push(x.name);
  return acc;
}, []);
\`\`\`
- **Impact**: ~30% faster for large arrays

### 🟡 Minor (Nice to have)

- [Issue description and fix]

### ✅ Already Optimized
- [Good patterns observed]
```

## Common Optimizations for FloraIQ

### TanStack Query
```typescript
// ✅ Enable stale-while-revalidate
const { data } = useQuery({
  queryKey: ['products', tenantId],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000,   // 30 minutes cache
});
```

### React Memoization
```typescript
// ✅ Memoize expensive computations
const sortedProducts = useMemo(() => 
  products?.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [products]
);

// ✅ Memoize callbacks passed to children
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);
```
