export const SkipToContent = () => (
  <a
    href="#main-content"
    onClick={(e) => {
      e.preventDefault();
      const el = document.getElementById("main-content");
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }}
    className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-lg"
  >
    Skip to main content
  </a>
);
