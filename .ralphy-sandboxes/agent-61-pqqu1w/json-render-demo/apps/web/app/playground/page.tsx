import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Playground | json-render",
};

export default function PlaygroundPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-4">Playground</h1>
      <p className="text-muted-foreground mb-12">
        Try json-render with a live example.
      </p>

      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-semibold mb-4">Run locally</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Clone the repository and run the example dashboard.
          </p>
          <pre className="text-sm mb-4">
            <code>{`git clone https://github.com/vercel-labs/json-render
cd json-render
pnpm install
pnpm dev`}</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            Open <code>http://localhost:3001</code> for the example dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Example prompts</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Try these prompts in the example dashboard:
          </p>
          <div className="space-y-2">
            {[
              "Create a revenue dashboard with monthly metrics",
              "Build a user management panel with a table",
              "Design a settings form with text inputs",
              "Make a notification center with alerts",
            ].map((prompt) => (
              <div
                key={prompt}
                className="p-3 border border-border rounded text-sm font-mono"
              >
                {prompt}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Interactive playground</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A browser-based playground is coming soon.
          </p>
          <Button variant="outline" asChild>
            <a
              href="https://github.com/vercel-labs/json-render"
              target="_blank"
              rel="noopener noreferrer"
            >
              Star on GitHub
            </a>
          </Button>
        </section>
      </div>
    </div>
  );
}
