import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useEffect, useRef, type ReactNode } from "react";
import { TabsUnderline, type TabItem } from "../common/tabs-underline.tsx";

interface ResourceHeaderProps {
  title: string;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  searchOpen?: boolean;
  searchValue?: string;
  onSearchToggle?: () => void;
  onSearchChange?: (value: string) => void;
  onSearchBlur?: () => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFilterClick?: () => void;
  onMenuClick?: () => void;
  ctaButton?: ReactNode;
}

export function ResourceHeader({
  title,
  tabs,
  activeTab,
  onTabChange,
  searchOpen,
  searchValue,
  onSearchToggle,
  onSearchChange,
  onSearchBlur,
  onSearchKeyDown,
  onFilterClick,
  onMenuClick,
  ctaButton,
}: ResourceHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Title */}
      <div className="flex items-center">
        <h1 className="text-2xl font-medium text-foreground">{title}</h1>
      </div>

      {/* Tabs and Actions Row */}
      <div className="flex items-end border-b border-border w-full">
        {/* Left: Tabs (if provided) */}
        {tabs && tabs.length > 0 && (
          <TabsUnderline
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        )}

        {/* Center: Spacer */}
        <div className="flex-1" />

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-1">
            {/* Search Button / Input */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onSearchToggle}
              className="h-9 w-9 rounded-xl flex items-center text-muted-foreground justify-center"
            >
              <Icon name="search" size={20} />
            </Button>
            {searchOpen && (
              <Input
                ref={searchInputRef}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onBlur={onSearchBlur}
                onKeyDown={onSearchKeyDown}
                placeholder="Search..."
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-9"
              />
            )}

            {/* Filter Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onFilterClick}
              className="h-9 w-9 rounded-xl flex items-center text-muted-foreground justify-center"
            >
              <Icon name="filter_list" size={20} />
            </Button>

            {/* Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-9 w-9 rounded-xl flex items-center text-muted-foreground justify-center"
            >
              <Icon name="more_horiz" size={20} />
            </Button>
          </div>

          {/* Divider + CTA Button */}
          {ctaButton && (
            <>
              <div className="self-stretch border-l border-border" />
              {ctaButton}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
