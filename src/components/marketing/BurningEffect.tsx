import { motion } from 'framer-motion';

export function BurningEffect() {
    // Simulate burning progress based on a timer or prop
    // For this demo, we'll just loop a burning effect

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            {/* Ember Particles */}
            <div className="absolute inset-0 z-20">
                {[...Array(10)].map((_, i) => (
                    <Ember key={i} delay={i * 0.5} />
                ))}
            </div>

            {/* Heat Haze / Glow Overlay */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent z-10"
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Bottom Burn Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-red-500/5 to-transparent" />
        </div>
    );
}

function Ember({ delay }: { delay: number }) {
    const randomX = Math.random() * 100;

    return (
        <motion.div
            className="absolute bottom-0 w-1 h-1 bg-orange-400 rounded-full blur-[1px]"
            style={{ left: `${randomX}%` }}
            initial={{ opacity: 0, y: 0, scale: 0 }}
            animate={{
                opacity: [0, 1, 0],
                y: -100 - Math.random() * 50,
                x: (Math.random() - 0.5) * 50,
                scale: [0, 1.5, 0]
            }}
            transition={{
                duration: 2 + Math.random(),
                repeat: Infinity,
                delay: delay,
                ease: "easeOut"
            }}
        />
    );
}
