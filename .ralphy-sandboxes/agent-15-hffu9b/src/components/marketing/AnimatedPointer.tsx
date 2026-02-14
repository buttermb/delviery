import { motion } from "framer-motion";

interface AnimatedPointerProps {
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}

export function AnimatedPointer({ direction = "down", className = "" }: AnimatedPointerProps) {
  const getRotation = () => {
    switch (direction) {
      case "up": return 180;
      case "left": return 90;
      case "right": return -90;
      default: return 0;
    }
  };

  const getAnimation = () => {
    switch (direction) {
      case "up": return { y: [-5, 0, -5] };
      case "down": return { y: [0, 5, 0] };
      case "left": return { x: [-5, 0, -5] };
      case "right": return { x: [0, 5, 0] };
      default: return { y: [0, 5, 0] };
    }
  };

  return (
    <motion.div
      className={`inline-block ${className}`}
      animate={getAnimation()}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ rotate: getRotation() }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <motion.path
          d="M12 5L12 19M12 19L5 12M12 19L19 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>
    </motion.div>
  );
}
