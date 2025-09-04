import { EventBanner, useCountdown } from "../event-banner";

const DECO_DAY_START_DATE = new Date("2025-09-08T14:00:00");
const DECO_DAY_END_DATE = new Date("2025-09-08T18:00:00");

const CountdownBox = ({ value, label }: { value: string; label: string }) => (
  <div className="bg-card rounded shadow-sm px-2 py-1 min-w-[40px] text-center">
    <div className="text-sm font-bold text-foreground leading-none">
      {value}
    </div>
    <div className="text-xs text-foreground">{label}</div>
  </div>
);

const Upcoming = () => {
  const { countdown } = useCountdown();
  const [days, hours, minutes, seconds] = countdown.split(":");

  return (
    <a
      href="https://deco.day"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gradient-to-r from-primary-light/60 to-primary-light/40 px-4 py-2 border-b border-primary-light/70 hover:bg-primary-light/80 transition-colors duration-200"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs font-medium text-foreground">
          deco.day starts in:
        </span>
        <CountdownBox value={days} label="D" />
        <CountdownBox value={hours} label="H" />
        <CountdownBox value={minutes} label="M" />
        <CountdownBox value={seconds} label="S" />
      </div>
    </a>
  );
};

const Active = () => {
  const { countdown } = useCountdown();
  const [days, hours, minutes, seconds] = countdown.split(":");

  return (
    <a
      href="https://deco.day"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gradient-to-r from-primary-light/80 to-primary-light/60 px-4 py-2 border-b border-primary-light/90 hover:bg-primary-light/95 transition-colors duration-200"
    >
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-foreground">LIVE:</span>
        </div>
        <CountdownBox value={days} label="D" />
        <CountdownBox value={hours} label="H" />
        <CountdownBox value={minutes} label="M" />
        <CountdownBox value={seconds} label="S" />
        <span className="text-xs text-muted-foreground">left</span>
      </div>
    </a>
  );
};

const Past = () => {
  return (
    <a
      href="https://deco.day"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gradient-to-r from-muted/80 to-muted/60 px-4 py-2 border-b border-border hover:bg-muted/90 transition-colors duration-200"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          deco.day ended
        </span>
        <div className="inline-block bg-primary-light text-primary-dark px-2 py-1 rounded text-xs font-medium hover:bg-primary-light/80 transition-colors">
          Watch Recording
        </div>
      </div>
    </a>
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
