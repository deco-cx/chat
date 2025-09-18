import { cn } from "@deco/ui/lib/utils.ts";

const BOUNTIES_URL = "https://bounties.decocms.com/";

const LinkWrapper = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <a
    href={BOUNTIES_URL}
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

export function BountiesBanner() {
  return (
    <LinkWrapper>
      <img
        src="/img/banner-v2.jpg"
        alt="bounties banner"
        className="w-full h-full object-cover"
      />
    </LinkWrapper>
  );
}
