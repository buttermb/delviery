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
    className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-lg"
  >
    Skip to main content
  </a>
);
