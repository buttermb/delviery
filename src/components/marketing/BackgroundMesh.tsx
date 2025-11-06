import { motion } from 'framer-motion';

interface BackgroundMeshProps {
  className?: string;
}

export function BackgroundMesh({ className = '' }: BackgroundMeshProps) {
  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      {/* Multiple gradient layers with different speeds */}
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 20% 50%, hsl(217, 91%, 55%) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsl(271, 81%, 56%) 0%, transparent 50%), radial-gradient(circle at 40% 20%, hsl(160, 84%, 35%) 0%, transparent 50%)',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(circle at 60% 30%, hsl(271, 81%, 56%) 0%, transparent 40%), radial-gradient(circle at 30% 70%, hsl(217, 91%, 55%) 0%, transparent 40%)',
        }}
        animate={{
          backgroundPosition: ['100% 100%', '0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, hsl(160, 84%, 35%) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Mesh pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}

