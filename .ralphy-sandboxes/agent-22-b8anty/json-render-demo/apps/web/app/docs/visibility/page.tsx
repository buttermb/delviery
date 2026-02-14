import Link from "next/link";
import { Code } from "@/components/code";

export const metadata = {
  title: "Visibility | json-render",
};

export default function VisibilityPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Visibility</h1>
      <p className="text-muted-foreground mb-8">
        Conditionally show or hide components based on data, auth, or logic.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">VisibilityProvider</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Wrap your app with VisibilityProvider to enable conditional rendering:
      </p>
      <Code lang="tsx">{`import { VisibilityProvider } from '@json-render/react';

function App() {
  return (
    <DataProvider initialData={data}>
      <VisibilityProvider>
        {/* Components can now use visibility conditions */}
      </VisibilityProvider>
    </DataProvider>
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Path-Based Visibility
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Show/hide based on data values:
      </p>
      <Code lang="json">{`{
  "type": "Alert",
  "props": { "message": "Form has errors" },
  "visible": { "path": "/form/hasErrors" }
}

// Visible when /form/hasErrors is truthy`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Auth-Based Visibility
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Show/hide based on authentication state:
      </p>
      <Code lang="json">{`{
  "type": "AdminPanel",
  "visible": { "auth": "signedIn" }
}

// Options: "signedIn", "signedOut", "admin", etc.`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Logic Expressions</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Combine conditions with logic operators:
      </p>
      <Code lang="json">{`// AND - all conditions must be true
{
  "type": "SubmitButton",
  "visible": {
    "and": [
      { "path": "/form/isValid" },
      { "path": "/form/hasChanges" }
    ]
  }
}

// OR - any condition must be true
{
  "type": "HelpText",
  "visible": {
    "or": [
      { "path": "/user/isNew" },
      { "path": "/settings/showHelp" }
    ]
  }
}

// NOT - invert a condition
{
  "type": "WelcomeBanner",
  "visible": {
    "not": { "path": "/user/hasSeenWelcome" }
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Comparison Operators</h2>
      <Code lang="json">{`// Equal
{
  "visible": {
    "eq": [{ "path": "/user/role" }, "admin"]
  }
}

// Greater than
{
  "visible": {
    "gt": [{ "path": "/cart/total" }, 100]
  }
}

// Available: eq, ne, gt, gte, lt, lte`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Complex Example</h2>
      <Code lang="json">{`{
  "type": "RefundButton",
  "props": { "label": "Process Refund" },
  "visible": {
    "and": [
      { "auth": "signedIn" },
      { "eq": [{ "path": "/user/role" }, "support"] },
      { "gt": [{ "path": "/order/amount" }, 0] },
      { "not": { "path": "/order/isRefunded" } }
    ]
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Using in Components</h2>
      <Code lang="tsx">{`import { useIsVisible } from '@json-render/react';

function ConditionalContent({ element, children }) {
  const isVisible = useIsVisible(element.visible);
  
  if (!isVisible) return null;
  return <div>{children}</div>;
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Next</h2>
      <p className="text-sm text-muted-foreground">
        Learn about{" "}
        <Link
          href="/docs/validation"
          className="text-foreground hover:underline"
        >
          form validation
        </Link>
        .
      </p>
    </article>
  );
}
