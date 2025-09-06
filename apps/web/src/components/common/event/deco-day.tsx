import { cn } from "@deco/ui/lib/utils.ts";
import { EventBanner, useCountdown } from "../event-banner";
import { Button } from "@deco/ui/components/button.tsx";

const DECO_DAY_START_DATE = new Date("2025-09-08T14:00:00");
const DECO_DAY_END_DATE = new Date("2025-09-08T18:00:00");

const CountdownBox = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center justify-center gap-2">
    <div className="text-xl @min-xl:text-3xl font-medium text-foreground">
      {value}
    </div>
    <div className="text-[10px]">{label}</div>
  </div>
);

const Separator = () => (
  <span className="text-xl @min-xl:text-2xl font-semibold">:</span>
);

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
        "@container",
        "bg-[url('/img/deco-day-upcoming-bg.svg')] bg-cover h-[120px] rounded-lg",
        "ring ring-border overflow-hidden hover:ring-4 transition-all duration-400",
        "flex items-center justify-between px-8",
      )}
    >
      <img
        src="/img/deco-day-logo-outline.svg"
        alt="deco.day upcoming"
        className="h-[30px] @min-xl:h-[50px] object-cover"
      />

      <div className="hidden @min-md:flex justify-end gap-2 @min-xl:gap-3">
        <CountdownBox value={days} label="days" />
        <Separator />
        <CountdownBox value={hours} label="hours" />
        <Separator />
        <CountdownBox value={minutes} label="minutes" />
        <Separator />
        <CountdownBox value={seconds} label="seconds" />
      </div>

      <Button variant="special">
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
  return (
    <EventBanner
      startDate={DECO_DAY_START_DATE}
      endDate={DECO_DAY_END_DATE}
      upcoming={<Upcoming />}
      active={<Active />}
      past={<Past />}
    />
  );
}
