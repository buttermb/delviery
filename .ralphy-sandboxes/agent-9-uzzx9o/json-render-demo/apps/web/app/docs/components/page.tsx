import Link from "next/link";
import { Code } from "@/components/code";

export const metadata = {
  title: "Components | json-render",
};

export default function ComponentsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Components</h1>
      <p className="text-muted-foreground mb-8">
        Register React components to render your catalog types.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">Component Registry</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Create a registry that maps catalog component types to React components:
      </p>
      <Code lang="tsx">{`const registry = {
  Card: ({ element, children }) => (
    <div className="card">
      <h2>{element.props.title}</h2>
      {element.props.description && (
        <p>{element.props.description}</p>
      )}
      {children}
    </div>
  ),
  
  Button: ({ element, onAction }) => (
    <button onClick={() => onAction(element.props.action, {})}>
      {element.props.label}
    </button>
  ),
};`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Component Props</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Each component receives these props:
      </p>
      <Code lang="typescript">{`interface ComponentProps {
  element: {
    key: string;
    type: string;
    props: Record<string, unknown>;
    children?: UIElement[];
    visible?: VisibilityCondition;
    validation?: ValidationSchema;
  };
  children?: React.ReactNode;  // Rendered children
  onAction: (name: string, params: object) => void;
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Using Data Binding</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Use hooks to read and write data:
      </p>
      <Code lang="tsx">{`import { useDataValue, useDataBinding } from '@json-render/react';

const Metric = ({ element }) => {
  // Read-only value
  const value = useDataValue(element.props.valuePath);
  
  return (
    <div className="metric">
      <span className="label">{element.props.label}</span>
      <span className="value">{formatValue(value)}</span>
    </div>
  );
};

const TextField = ({ element }) => {
  // Two-way binding
  const [value, setValue] = useDataBinding(element.props.valuePath);
  
  return (
    <input
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      placeholder={element.props.placeholder}
    />
  );
};`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Using the Renderer</h2>
      <Code lang="tsx">{`import { Renderer } from '@json-render/react';

function App() {
  return (
    <Renderer
      tree={uiTree}
      registry={registry}
    />
  );
}`}</Code>

      <h2 className="text-xl font-semibold mt-12 mb-4">Next</h2>
      <p className="text-sm text-muted-foreground">
        Learn about{" "}
        <Link
          href="/docs/data-binding"
          className="text-foreground hover:underline"
        >
          data binding
        </Link>{" "}
        for dynamic values.
      </p>
    </article>
  );
}
