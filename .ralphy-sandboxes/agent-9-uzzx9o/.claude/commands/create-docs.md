# Create Docs Command

Generate comprehensive documentation for code, APIs, or features.

## Usage
Run `/create-docs [file or feature name]` to generate documentation.

## Instructions

### 1. Analyze the Target

Read the code to understand:
- Purpose and responsibility
- Inputs/outputs and parameters
- Dependencies and integrations
- Edge cases and error handling

### 2. Choose Documentation Type

#### Component Documentation
```markdown
# ComponentName

Brief description of what this component does.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | `string` | ✅ | - | Unique identifier |
| `onSelect` | `(item: Item) => void` | ❌ | - | Callback when selected |

## Usage

\`\`\`tsx
import { ComponentName } from '@/components/ComponentName';

<ComponentName 
  id="123"
  onSelect={(item) => console.log(item)}
/>
\`\`\`

## Examples

### Basic Usage
[Code example]

### With Custom Styling
[Code example]

## Notes
- [Any gotchas or important information]
```

#### Hook Documentation
```markdown
# useHookName

Brief description.

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `initialValue` | `T` | Initial value |

## Returns

| Property | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current value |
| `setValue` | `(v: T) => void` | Update function |

## Usage

\`\`\`typescript
const { value, setValue } = useHookName(initialValue);
\`\`\`
```

#### API/RPC Documentation
```markdown
# function_name

Brief description.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `p_store_id` | `uuid` | ✅ | Store identifier |

## Returns

\`\`\`typescript
{
  success: boolean;
  data?: { ... };
  error?: string;
}
\`\`\`

## Example

\`\`\`sql
SELECT * FROM function_name('store-uuid');
\`\`\`

## Errors

| Code | Description |
|------|-------------|
| `STORE_NOT_FOUND` | Store ID doesn't exist |
```

### 3. Output Location

Save documentation to appropriate location:
- Components: `src/components/[name]/README.md`
- Hooks: `docs/hooks/[name].md`
- APIs: `docs/api/[name].md`
- Features: `docs/features/[name].md`

## Output Format

```markdown
## Documentation Created ✅

### File: [path/to/documentation.md]

### Contents:
- Overview
- Parameters/Props
- Usage Examples
- Error Handling
- Related Components/APIs

### Next Steps:
- [ ] Review for accuracy
- [ ] Add more examples if needed
- [ ] Link from main docs index
```
