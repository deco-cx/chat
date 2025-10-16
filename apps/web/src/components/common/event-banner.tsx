import { cn } from "@deco/ui/lib/utils.ts";
import { Button } from "@deco/ui/components/button.tsx";
import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const CountdownContext = createContext<{
  countdown: string;
}>({
  countdown: "",
});

const getCountdownString = (targetDate: Date): string => {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const difference = target - now;

  if (difference <= 0) return "00:00:00:00";

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

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

export interface EventState {
  /** Small uppercase subtitle text */
  subtitle: string;
  /** Main message text */
  title: string;
  /** Button text */
  buttonText: string;
  /** Button click handler or href */
  buttonAction?: (() => void) | string;
  /** Target for link when buttonAction is a string */
  target?: string;
  /** Whether to open link in new tab (default: true for external links) */
  newTab?: boolean;
}

export interface EventBannerProps {
  /** Event start date */
  startDate: Date;
  /** Event end date */
  endDate: Date;
  /** Content for before the event starts */
  upcoming: EventState;
  /** Content during the event */
  active: EventState;
  /** Content after the event ends */
  past: EventState;
  /** Optional left background image/SVG placeholder */
  leftBackgroundImage?: string;
  /** Optional right background image/SVG placeholder */
  rightBackgroundImage?: string;
  /** Custom className for the banner */
  className?: string;
  /** Custom content instead of default text layout */
  children?: ReactNode;
  /** Custom background color (default: bg-dc-900) */
  backgroundColor?: string;
  /** Custom text color for subtitle and dates (default: text-dc-50 and text-dc-300) */
  textColor?: string;
  /** Custom text color for secondary elements (default: text-dc-300) */
  secondaryTextColor?: string;
  /** Custom title text color (default: text-[#d0ec1a]) */
  titleColor?: string;
  /** Custom button background color (default: bg-[#d0ec1a]) */
  buttonBackgroundColor?: string;
  /** Custom button text color (default: text-[#07401a]) */
  buttonTextColor?: string;
}

const CountdownBox = ({
  value,
  label,
  textColor = "text-dc-50",
  secondaryTextColor = "text-dc-300",
}: {
  value: string;
  label: string;
  textColor?: string;
  secondaryTextColor?: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-1">
    <div className={`text-sm @min-xl:text-lg font-medium ${textColor}`}>
      {value}
    </div>
    <div className={`text-xs ${secondaryTextColor}`}>{label}</div>
  </div>
);

const Separator = ({ color = "text-dc-300" }: { color?: string }) => (
  <span className={`text-sm @min-xl:text-lg font-semibold ${color}`}>:</span>
);

export function EventBanner({
  startDate,
  endDate,
  upcoming,
  active,
  past,
  leftBackgroundImage,
  rightBackgroundImage,
  className,
  children,
  backgroundColor = "bg-dc-900",
  textColor = "text-dc-50",
  secondaryTextColor = "text-dc-300",
  titleColor = "text-[#d0ec1a]",
  buttonBackgroundColor = "bg-[#d0ec1a]",
  buttonTextColor = "text-[#07401a]",
}: EventBannerProps) {
  const [countdown, setCountdown] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const state = getEventState(startDate, endDate);

  const currentState =
    state === "upcoming" ? upcoming : state === "active" ? active : past;
  const isExternalLink = typeof currentState.buttonAction === "string";

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
      <div
        className={cn(
          "relative w-full h-32 mb-10 rounded-lg overflow-hidden",
          "flex items-center justify-between pl-32 pr-20 py-0 @container",
          backgroundColor,
          className,
        )}
      >
        {/* Left background image */}
        {leftBackgroundImage && (
          <div className="absolute left-0 top-0 h-32 w-[900px] pointer-events-none">
            <img
              src={leftBackgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover max-w-none object-center"
            />
          </div>
        )}

        {/* Right background image */}
        {rightBackgroundImage && (
          <div className="absolute right-0 bottom-0 h-32 w-[355px] pointer-events-none">
            <img
              src={rightBackgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover max-w-none object-center"
            />
          </div>
        )}

        {/* Content */}
        {children || (
          <>
            {/* Text content */}
            <div className="flex flex-col items-start leading-none relative z-10 flex-1 min-w-0 pr-4">
              <div
                className={`font-mono flex flex-row items-center gap-2 text-sm uppercase font-normal leading-none ${textColor}`}
              >
                {currentState.subtitle}
                {/* Date indicator */}
                <div
                  className={`text-xs uppercase tracking-wide ${secondaryTextColor}`}
                >
                  {startDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  @{" "}
                  {startDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div
                className={`font-sans text-xl font-normal leading-8 whitespace-pre ${titleColor}`}
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {currentState.title}
              </div>
            </div>

            {/* Countdown and Button grouped together */}
            <div className="relative z-10 shrink-0 flex items-center gap-4">
              {/* Countdown for upcoming events */}
              {state === "upcoming" && (
                <div className="hidden @min-md:flex flex-col items-center gap-2">
                  {/* Countdown timer */}
                  <div className="flex justify-center gap-2 @min-xl:gap-3">
                    {(() => {
                      const [days, hours, minutes, seconds] = (
                        countdown || "00:00:00:00"
                      ).split(":");
                      return (
                        <>
                          <CountdownBox
                            value={days}
                            label="days"
                            textColor={textColor}
                            secondaryTextColor={secondaryTextColor}
                          />
                          <Separator color={secondaryTextColor} />
                          <CountdownBox
                            value={hours}
                            label="hours"
                            textColor={textColor}
                            secondaryTextColor={secondaryTextColor}
                          />
                          <Separator color={secondaryTextColor} />
                          <CountdownBox
                            value={minutes}
                            label="minutes"
                            textColor={textColor}
                            secondaryTextColor={secondaryTextColor}
                          />
                          <Separator color={secondaryTextColor} />
                          <CountdownBox
                            value={seconds}
                            label="seconds"
                            textColor={textColor}
                            secondaryTextColor={secondaryTextColor}
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Button */}
              <div>
                {isExternalLink ? (
                  <Button
                    variant="special"
                    size="default"
                    asChild
                    className={`w-[110px] ${buttonBackgroundColor} ${buttonTextColor}`}
                  >
                    <a
                      href={
                        typeof currentState.buttonAction === "string"
                          ? currentState.buttonAction
                          : "#"
                      }
                      target={
                        currentState.newTab !== false
                          ? currentState.target || "_blank"
                          : undefined
                      }
                      rel={
                        currentState.newTab !== false
                          ? "noopener noreferrer"
                          : undefined
                      }
                    >
                      {currentState.buttonText}
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="special"
                    size="default"
                    onClick={
                      typeof currentState.buttonAction === "function"
                        ? currentState.buttonAction
                        : undefined
                    }
                    className={`w-[110px] ${buttonBackgroundColor} ${buttonTextColor}`}
                  >
                    {currentState.buttonText}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </CountdownContext.Provider>
  );
}
