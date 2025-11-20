import { motion } from "framer-motion";

export function AnimatedMeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ willChange: 'auto' }}>
      <div className="absolute inset-0 opacity-30">
        {/* Top Left Blob */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] 
          bg-gradient-to-br from-[hsl(var(--marketing-primary))/0.4] via-[hsl(var(--marketing-accent))/0.3] to-transparent 
          blur-3xl animate-blob mix-blend-screen" />
        
        {/* Top Right Blob */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] 
          bg-gradient-to-bl from-[hsl(var(--marketing-secondary))/0.4] via-[hsl(var(--marketing-primary))/0.3] to-transparent 
          blur-3xl animate-blob animation-delay-2000 mix-blend-screen" />
        
        {/* Bottom Center Blob */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] 
          bg-gradient-to-t from-[hsl(var(--marketing-accent))/0.4] via-[hsl(var(--marketing-secondary))/0.3] to-transparent 
          blur-3xl animate-blob animation-delay-4000 mix-blend-screen" />
      </div>
      
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')] opacity-20 mix-blend-overlay" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />
    </div>
  );
}
