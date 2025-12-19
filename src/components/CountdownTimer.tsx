import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  endTime: Date;
  label?: string;
}

const CountdownTimer = ({ endTime, label = "Offer ends in" }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = endTime.getTime() - now;

      if (distance < 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (timeLeft === "Expired") return null;

  return (
    <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-sm font-semibold">
      <Clock className="w-4 h-4 animate-pulse" />
      <span>{label}: {timeLeft}</span>
    </div>
  );
};

export default CountdownTimer;
