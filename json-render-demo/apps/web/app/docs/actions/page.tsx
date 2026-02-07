import Link from "next/link";
import { Code } from "@/components/code";

export const metadata = {
  title: "Actions | json-render",
};

export default function ActionsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Actions</h1>
      <p className="text-muted-foreground mb-8">
        Handle user interactions safely with named actions.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">Why Named Actions?</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Instead of AI generating arbitrary code, it declares <em>intent</em> by
        name. Your application provides the implementation. This is a core
        guardrail.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">Defining Actions</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Define available actions in your catalog:
      </p>
      <Code lang="typescript">{`const catalog = createCatalog({
  components: { /* ... */ },
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
        filters: z.object({
          dateRange: z.string().optional(),
        }).optional(),
      }),
    },
    navigate: {
      params: z.object({
        url: z.string(),
      }),
    },
  },
});`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">ActionProvider</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Provide action handlers to your app:
      </p>
      <Code lang="tsx">{`import { ActionProvider } from '@json-render/react';

function App() {
  const handlers = {
    submit_form: async (params) => {
      const response = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify({ formId: params.formId }),
      });
      return response.json();
    },
    
    export_data: async (params) => {
      const blob = await generateExport(params.format, params.filters);
      downloadBlob(blob, \`export.\${params.format}\`);
    },
    
    navigate: (params) => {
      window.location.href = params.url;
    },
  };

  return (
    <ActionProvider handlers={handlers}>
      {/* Your UI */}
    </ActionProvider>
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Using Actions in Components
      </h2>
      <Code lang="tsx">{`const Button = ({ element, onAction }) => (
  <button onClick={() => onAction(element.props.action, {})}>
    {element.props.label}
  </button>
);

// Or use the useAction hook
import { useAction } from '@json-render/react';

function SubmitButton() {
  const submitForm = useAction('submit_form');
  
  return (
    <button onClick={() => submitForm({ formId: 'contact' })}>
      Submit
    </button>
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Actions with Confirmation
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        AI can declare actions that require user confirmation:
      </p>
      <Code lang="json">{`{
  "type": "Button",
  "props": {
    "label": "Delete Account",
    "action": {
      "name": "delete_account",
      "params": { "userId": "123" },
      "confirm": {
        "title": "Delete Account?",
        "message": "This action cannot be undone.",
        "variant": "danger"
      }
    }
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Action Callbacks</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Handle success and error states:
      </p>
      <Code lang="json">{`{
  "type": "Button",
  "props": {
    "label": "Save",
    "action": {
      "name": "save_changes",
      "params": { "documentId": "doc-1" },
      "onSuccess": {
        "set": { "/ui/savedMessage": "Changes saved!" }
      },
      "onError": {
        "set": { "/ui/errorMessage": "$error.message" }
      }
    }
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Next</h2>
      <p className="text-sm text-muted-foreground">
        Learn about{" "}
        <Link
          href="/docs/visibility"
          className="text-foreground hover:underline"
        >
          conditional visibility
        </Link>
        .
      </p>
    </article>
  );
}
