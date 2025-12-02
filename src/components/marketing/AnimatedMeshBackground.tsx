/**
 * AnimatedMeshBackground - Optimized background with CSS-only animations
 * Uses will-change and GPU-accelerated properties for smooth performance
 */

export function AnimatedMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static gradient blobs - no JS animations */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--marketing-primary) / 0.4) 0%, transparent 70%)',
          }} 
        />
        <div 
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--marketing-secondary) / 0.3) 0%, transparent 70%)',
          }} 
        />
      </div>
    </div>
  );
}
