import { cn } from "@deco/ui/lib/utils.ts";
import { EventBanner, useCountdown } from "../event-banner";
import { Button } from "@deco/ui/components/button.tsx";
import { useState } from "react";

const DECO_DAY_START_DATE = new Date("2025-09-08T14:00:00");
const DECO_DAY_END_DATE = new Date("2025-09-08T18:00:00");

const CountdownBox = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center justify-center gap-2">
    <div className="text-3xl font-medium text-foreground">{value}</div>
    <div className="text-[10px]">{label}</div>
  </div>
);

const Separator = () => <span className="text-2xl font-semibold">:</span>;

const LinkWrapper = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <a
    href="https://deco.day"
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      "w-full h-[120px] rounded-lg ring ring-border overflow-hidden hover:ring-4 transition-all duration-400",
      className,
    )}
  >
    {children}
  </a>
);

const Upcoming = () => {
  const { countdown } = useCountdown();
  const [days, hours, minutes, seconds] = countdown.split(":");

  return (
    <a
      href="https://deco.day"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "bg-[url('/img/deco-day-upcoming-bg.svg')] bg-cover h-[120px] rounded-lg ring ring-border overflow-hidden hover:ring-4 transition-all duration-400 flex items-center",
      )}
    >
      <div className="flex flex-col items-start self-end shrink-0">
        <span className="px-6 bg-black text-white">@techweeksaopaulo</span>
        <span className="px-6 py-4 bg-black text-white text-[28px]">
          Learn from industry leaders
        </span>
      </div>

      <img
        src="/img/deco-day-logo-outline.svg"
        alt="deco.day upcoming"
        className="h-[50px] object-cover ml-auto mr-4"
      />

      <div className="flex justify-end gap-3 ml-auto">
        <CountdownBox value={days} label="days" />
        <Separator />
        <CountdownBox value={hours} label="hours" />
        <Separator />
        <CountdownBox value={minutes} label="minutes" />
        <Separator />
        <CountdownBox value={seconds} label="seconds" />
      </div>

      <Button variant="special" className="ml-auto mr-4">
        <span>Watch on YouTube</span>
      </Button>
    </a>
  );
};

const Active = () => {
  return (
    <LinkWrapper>
      <img
        src="/img/deco-day-live.png"
        alt="deco.day live"
        className="w-full h-full object-cover"
      />
    </LinkWrapper>
  );
};

const Past = () => {
  return (
    <LinkWrapper>
      <img
        src="/img/deco-day-past.png"
        alt="deco.day past"
        className="w-full h-full object-cover"
      />
    </LinkWrapper>
  );
};

export function DecoDayBanner() {
  const [state, setState] = useState<"upcoming" | "active" | "past">(
    "upcoming",
  );

  const cycle = () => {
    setState((prev) => {
      if (prev === "upcoming") return "active";
      if (prev === "active") return "past";
      return "upcoming";
    });
  };

  return (
    <>
      <EventBanner
        startDate={DECO_DAY_START_DATE}
        endDate={DECO_DAY_END_DATE}
        upcoming={
          state === "upcoming" ? (
            <Upcoming />
          ) : state === "active" ? (
            <Active />
          ) : (
            <Past />
          )
        }
        active={<Active />}
        past={<Past />}
      />
      <div className="fixed top-4 right-4">
        <button
          className="cursor-pointer p-1 border border-border rounded-md bg-background"
          onClick={cycle}
        >
          cycle
        </button>
      </div>
    </>
  );
}
