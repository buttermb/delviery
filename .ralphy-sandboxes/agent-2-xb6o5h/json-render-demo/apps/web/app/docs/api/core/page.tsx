import { Code } from "@/components/code";

export const metadata = {
  title: "@json-render/core API | json-render",
};

export default function CoreApiPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">@json-render/core</h1>
      <p className="text-muted-foreground mb-8">
        Core types, schemas, and utilities.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">createCatalog</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Creates a catalog definition.
      </p>
      <Code lang="typescript">{`function createCatalog(config: CatalogConfig): Catalog

interface CatalogConfig {
  components: Record<string, ComponentDefinition>;
  actions?: Record<string, ActionDefinition>;
  validationFunctions?: Record<string, ValidationFunctionDef>;
}

interface ComponentDefinition {
  props: ZodObject;
  hasChildren?: boolean;
  description?: string;
}

interface ActionDefinition {
  params?: ZodObject;
  description?: string;
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        generateCatalogPrompt
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Generates a system prompt for AI models.
      </p>
      <Code lang="typescript">{`function generateCatalogPrompt(catalog: Catalog): string`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">evaluateVisibility</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Evaluates a visibility condition against data and auth state.
      </p>
      <Code lang="typescript">{`function evaluateVisibility(
  condition: VisibilityCondition | undefined,
  data: Record<string, unknown>,
  auth?: AuthState
): boolean

type VisibilityCondition =
  | { path: string }
  | { auth: 'signedIn' | 'signedOut' | string }
  | { and: VisibilityCondition[] }
  | { or: VisibilityCondition[] }
  | { not: VisibilityCondition }
  | { eq: [DynamicValue, DynamicValue] }
  | { gt: [DynamicValue, DynamicValue] }
  | { gte: [DynamicValue, DynamicValue] }
  | { lt: [DynamicValue, DynamicValue] }
  | { lte: [DynamicValue, DynamicValue] };`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Types</h2>

      <h3 className="text-lg font-semibold mt-8 mb-4">UIElement</h3>
      <Code lang="typescript">{`interface UIElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: UIElement[];
  visible?: VisibilityCondition;
  validation?: ValidationSchema;
}`}</Code>

      <h3 className="text-lg font-semibold mt-8 mb-4">UITree</h3>
      <Code lang="typescript">{`interface UITree {
  root: UIElement | null;
  elements: Record<string, UIElement>;
}`}</Code>

      <h3 className="text-lg font-semibold mt-8 mb-4">Action</h3>
      <Code lang="typescript">{`interface Action {
  name: string;
  params?: Record<string, unknown>;
  confirm?: {
    title: string;
    message: string;
    variant?: 'default' | 'danger';
  };
  onSuccess?: { set: Record<string, unknown> };
  onError?: { set: Record<string, unknown> };
}`}</Code>

      <h3 className="text-lg font-semibold mt-8 mb-4">ValidationSchema</h3>
      <Code lang="typescript">{`interface ValidationSchema {
  checks: ValidationCheck[];
  validateOn?: 'change' | 'blur' | 'submit';
}

interface ValidationCheck {
  fn: string;
  args?: Record<string, unknown>;
  message: string;
}`}</Code>
    </article>
  );
}
