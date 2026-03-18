import { PackageInstall } from "@/components/package-install";

export const metadata = {
  title: "Installation | json-render",
};

export default function InstallationPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-4">Installation</h1>
      <p className="text-muted-foreground mb-8">
        Install the core and React packages to get started.
      </p>

      <h2 className="text-xl font-semibold mt-12 mb-4">Install packages</h2>
      <PackageInstall packages="@json-render/core @json-render/react" />

      <h2 className="text-xl font-semibold mt-12 mb-4">Peer Dependencies</h2>
      <p className="text-sm text-muted-foreground mb-4">
        json-render requires the following peer dependencies:
      </p>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
        <li>
          <code className="text-foreground">react</code> ^19.0.0
        </li>
        <li>
          <code className="text-foreground">zod</code> ^4.0.0
        </li>
      </ul>
      <PackageInstall packages="react zod" />

      <h2 className="text-xl font-semibold mt-12 mb-4">For AI Integration</h2>
      <p className="text-sm text-muted-foreground mb-4">
        To use json-render with AI models, you&apos;ll also need the Vercel AI
        SDK:
      </p>
      <PackageInstall packages="ai" />
    </article>
  );
}
