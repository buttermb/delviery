import Link from "next/link";
import { Code } from "@/components/code";

export const metadata = {
  title: "Catalog | json-render",
};

export default function CatalogPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Catalog</h1>
      <p className="text-muted-foreground mb-8">
        The catalog defines what AI can generate. It&apos;s your guardrail.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">What is a Catalog?</h2>
      <p className="text-sm text-muted-foreground mb-4">
        A catalog is a schema that defines:
      </p>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
        <li>
          <strong className="text-foreground">Components</strong> — UI elements
          AI can create
        </li>
        <li>
          <strong className="text-foreground">Actions</strong> — Operations AI
          can trigger
        </li>
        <li>
          <strong className="text-foreground">Validation Functions</strong> —
          Custom validators for form inputs
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-12 mb-4">Creating a Catalog</h2>
      <Code lang="typescript">{`import { createCatalog } from '@json-render/core';
import { z } from 'zod';

const catalog = createCatalog({
  components: {
    // Define each component with its props schema
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().nullable(),
        padding: z.enum(['sm', 'md', 'lg']).default('md'),
      }),
      hasChildren: true, // Can contain other components
    },
    
    Metric: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(), // JSON Pointer to data
        format: z.enum(['currency', 'percent', 'number']),
      }),
    },
  },
  
  actions: {
    submit_form: {
      params: z.object({
        formId: z.string(),
      }),
      description: 'Submit a form',
    },
    
    export_data: {
      params: z.object({
        format: z.enum(['csv', 'pdf', 'json']),
      }),
    },
  },
  
  validationFunctions: {
    isValidEmail: {
      description: 'Validates email format',
    },
    isPhoneNumber: {
      description: 'Validates phone number',
    },
  },
});`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Component Definition</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Each component in the catalog has:
      </p>
      <Code lang="typescript">{`{
  props: z.object({...}),  // Zod schema for props
  hasChildren?: boolean,    // Can it have children?
  description?: string,     // Help AI understand when to use it
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Generating AI Prompts
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Use <code className="text-foreground">generateCatalogPrompt</code> to
        create a system prompt for AI:
      </p>
      <Code lang="typescript">{`import { generateCatalogPrompt } from '@json-render/core';

const systemPrompt = generateCatalogPrompt(catalog);
// Pass this to your AI model as the system prompt`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Next</h2>
      <p className="text-sm text-muted-foreground">
        Learn how to{" "}
        <Link
          href="/docs/components"
          className="text-foreground hover:underline"
        >
          register React components
        </Link>{" "}
        for your catalog.
      </p>
    </article>
  );
}
