import { createContext, useContext, useEffect, useRef, useState } from "react";

const CountdownContext = createContext<{
  countdown: string;
}>({
  countdown: "",
});

export const useCountdown = () => {
  return useContext(CountdownContext);
};

const getCountdownString = (targetDate: Date): string => {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "00:00:00:00";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${days.toString().padStart(2, "0")}:${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getEventState = (
  startDate: Date,
  endDate: Date,
): "upcoming" | "active" | "past" => {
  const now = new Date();
  if (now < startDate) {
    return "upcoming";
  }
  if (now > endDate) {
    return "past";
  }
  return "active";
};

export interface EventBannerProps {
  startDate: Date;
  endDate: Date;
  upcoming: React.ReactNode;
  active: React.ReactNode;
  past: React.ReactNode;
}

export function EventBanner({
  startDate,
  endDate,
  upcoming,
  active,
  past,
}: EventBannerProps) {
  const [countdown, setCountdown] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const state = getEventState(startDate, endDate);

  useEffect(() => {
    const updateCountdown = () => {
      const targetDate = state === "upcoming" ? startDate : endDate;
      setCountdown(getCountdownString(targetDate));
    };

    // Initial countdown update
    updateCountdown();

    // Set up interval to update countdown every second
    intervalRef.current = setInterval(updateCountdown, 1000);

    // Cleanup interval on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startDate, endDate, state]);

  return (
    <CountdownContext.Provider value={{ countdown }}>
      {state === "upcoming" ? upcoming : state === "active" ? active : past}
    </CountdownContext.Provider>
  );
}
