export function TrustedBy() {
    return (
        <section className="py-10 border-y border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))/0.3]">
            <div className="container mx-auto px-4 text-center">
                <p className="text-sm font-medium text-[hsl(var(--marketing-text-light))] uppercase tracking-wider">
                    Built for licensed cannabis operators
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-8 text-[hsl(var(--marketing-text-light))]">
                    <span className="text-sm">Wholesale Distribution</span>
                    <span className="text-sm hidden sm:inline" aria-hidden="true">&middot;</span>
                    <span className="text-sm">Inventory Management</span>
                    <span className="text-sm hidden sm:inline" aria-hidden="true">&middot;</span>
                    <span className="text-sm">Compliance Ready</span>
                    <span className="text-sm hidden sm:inline" aria-hidden="true">&middot;</span>
                    <span className="text-sm">Multi-Tenant Platform</span>
                </div>
            </div>
        </section>
    );
}
