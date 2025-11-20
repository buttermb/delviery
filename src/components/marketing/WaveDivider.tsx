import { motion } from "framer-motion";

interface WaveDividerProps {
    position?: "top" | "bottom";
    color?: string;
    className?: string;
}

export function WaveDivider({
    position = "bottom",
    color = "hsl(var(--marketing-bg-subtle))",
    className = ""
}: WaveDividerProps) {
    return (
        <div
            className={`absolute left-0 w-full overflow-hidden leading-none z-10 ${position === "top" ? "top-0 rotate-180" : "bottom-0"
                } ${className}`}
        >
            <svg
                className="relative block w-[calc(100%+1.3px)] h-[60px] sm:h-[100px]"
                data-name="Layer 1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1200 120"
                preserveAspectRatio="none"
            >
                <motion.path
                    animate={{
                        d: [
                            "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z",
                            "M321.39,45.44c68-15.79,124.16-25.13,182-35.86,92.39-20.72,178.19-12.73,260.45,4.39C843.78,38,916.67,82,995.66,102.83c80.05,23.48,156.53,31.09,224.34,8V0H0V35.35A600.21,600.21,0,0,0,321.39,45.44Z",
                            "M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
                        ]
                    }}
                    transition={{ 
                        duration: 8, 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        repeatType: "reverse"
                    }}
                    fill={color}
                    className="fill-current opacity-70"
                />
                <motion.path
                    animate={{
                        d: [
                            "M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z",
                            "M985.66,82.83C916.67,62,833.78,41,753.84,24.19c-92.26-22.34-178.06-11.33-260.45,5.39-67.84,16.73-124,36.07-182,46.86A600.21,600.21,0,0,1,0,37.35V120H1200V85.8C1142.19,108.92,1065.71,101.31,985.66,82.83Z",
                            "M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
                        ]
                    }}
                    transition={{ 
                        duration: 6, 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        repeatType: "reverse"
                    }}
                    fill={color}
                    className="opacity-40"
                />
            </svg>
        </div>
    );
}
