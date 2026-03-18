/**
 * IntersectionObserver-based prefetch for lazy-loading Remotion compositions.
 */

let prefetched = false;

/** Trigger prefetch of the ProductDemo composition chunk */
export function preloadProductDemo(): void {
  if (prefetched) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          prefetched = true;
          // Dynamically import the composition to warm the chunk cache
          void import('@/remotion/compositions/ProductDemo/index');
          observer.disconnect();
        }
      }
    },
    { rootMargin: '400px' },
  );

  // Observe the video showcase section if it exists
  const target = document.getElementById('video-showcase-section');
  if (target) {
    observer.observe(target);
  }
}
