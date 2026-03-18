/**
 * Hook to check if the View Transitions API is supported in the current browser
 *
 * The View Transitions API enables smooth animations between page transitions.
 * This hook checks for browser support at runtime.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 * @see https://reactrouter.com/how-to/view-transitions
 *
 * @returns {boolean} true if View Transitions API is supported, false otherwise
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const supportsViewTransitions = useViewTransitionSupport();
 *
 *   return (
 *     <div>
 *       {supportsViewTransitions ? (
 *         <p>Your browser supports smooth page transitions!</p>
 *       ) : (
 *         <p>Your browser doesn't support View Transitions API</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewTransitionSupport(): boolean {
  // Check if document and startViewTransition are available
  if (typeof document === 'undefined') {
    return false;
  }

  // Check if the browser supports the View Transitions API
  return 'startViewTransition' in document;
}
