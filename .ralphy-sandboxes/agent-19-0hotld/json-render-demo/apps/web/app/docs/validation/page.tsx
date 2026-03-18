import Link from "next/link";
import { Code } from "@/components/code";

export const metadata = {
  title: "Validation | json-render",
};

export default function ValidationPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Validation</h1>
      <p className="text-muted-foreground mb-8">
        Validate form inputs with built-in and custom functions.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">Built-in Validators</h2>
      <p className="text-sm text-muted-foreground mb-4">
        json-render includes common validation functions:
      </p>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
        <li>
          <code className="text-foreground">required</code> — Value must be
          non-empty
        </li>
        <li>
          <code className="text-foreground">email</code> — Valid email format
        </li>
        <li>
          <code className="text-foreground">minLength</code> — Minimum string
          length
        </li>
        <li>
          <code className="text-foreground">maxLength</code> — Maximum string
          length
        </li>
        <li>
          <code className="text-foreground">pattern</code> — Match a regex
          pattern
        </li>
        <li>
          <code className="text-foreground">min</code> — Minimum numeric value
        </li>
        <li>
          <code className="text-foreground">max</code> — Maximum numeric value
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Using Validation in JSON
      </h2>
      <Code lang="json">{`{
  "type": "TextField",
  "props": {
    "label": "Email",
    "valuePath": "/form/email",
    "checks": [
      { "fn": "required", "message": "Email is required" },
      { "fn": "email", "message": "Invalid email format" }
    ],
    "validateOn": "blur"
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Validation with Parameters
      </h2>
      <Code lang="json">{`{
  "type": "TextField",
  "props": {
    "label": "Password",
    "valuePath": "/form/password",
    "checks": [
      { "fn": "required", "message": "Password is required" },
      { 
        "fn": "minLength", 
        "args": { "length": 8 },
        "message": "Password must be at least 8 characters"
      },
      {
        "fn": "pattern",
        "args": { "pattern": "[A-Z]" },
        "message": "Must contain at least one uppercase letter"
      }
    ]
  }
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">
        Custom Validation Functions
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Define custom validators in your catalog:
      </p>
      <Code lang="typescript">{`const catalog = createCatalog({
  components: { /* ... */ },
  validationFunctions: {
    isValidPhone: {
      description: 'Validates phone number format',
    },
    isUniqueEmail: {
      description: 'Checks if email is not already registered',
    },
  },
});`}</Code>

      <p className="text-sm text-muted-foreground mb-4">
        Then implement them in your ValidationProvider:
      </p>
      <Code lang="tsx">{`import { ValidationProvider } from '@json-render/react';

function App() {
  const customValidators = {
    isValidPhone: (value) => {
      const phoneRegex = /^\\+?[1-9]\\d{1,14}$/;
      return phoneRegex.test(value);
    },
    isUniqueEmail: async (value) => {
      const response = await fetch(\`/api/check-email?email=\${value}\`);
      const { available } = await response.json();
      return available;
    },
  };

  return (
    <ValidationProvider functions={customValidators}>
      {/* Your UI */}
    </ValidationProvider>
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Using in Components</h2>
      <Code lang="tsx">{`import { useFieldValidation } from '@json-render/react';

function TextField({ element }) {
  const { value, setValue, errors, validate } = useFieldValidation(
    element.props.valuePath,
    element.props.checks
  );

  return (
    <div>
      <label>{element.props.label}</label>
      <input
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => validate()}
      />
      {errors.map((error, i) => (
        <p key={i} className="text-red-500 text-sm">{error}</p>
      ))}
    </div>
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Validation Timing</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Control when validation runs with{" "}
        <code className="text-foreground">validateOn</code>:
      </p>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
        <li>
          <code className="text-foreground">change</code> — Validate on every
          input change
        </li>
        <li>
          <code className="text-foreground">blur</code> — Validate when field
          loses focus
        </li>
        <li>
          <code className="text-foreground">submit</code> — Validate only on
          form submission
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-12 mb-4">Next</h2>
      <p className="text-sm text-muted-foreground">
        Learn about{" "}
        <Link href="/docs/ai-sdk" className="text-foreground hover:underline">
          AI SDK integration
        </Link>
        .
      </p>
    </article>
  );
}
