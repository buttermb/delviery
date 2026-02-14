interface NYMLogoProps {
  size?: number;
  className?: string;
}

const NYMLogo = ({ size = 50, className = "" }: NYMLogoProps) => {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-full bg-gradient-primary border-2 border-primary/30 shadow-glow transition-all duration-300 hover:scale-105 hover:shadow-elegant ${className}`}
      style={{ 
        width: size, 
        height: size 
      }}
    >
      <span 
        className="font-black text-white tracking-wider select-none"
        style={{ 
          fontSize: size * 0.35,
        }}
      >
        NYM
      </span>
    </div>
  );
};

export default NYMLogo;
