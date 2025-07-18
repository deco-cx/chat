import { ListPageHeader } from "../../common/list-page-header.tsx";
import type { ViewModeSwitcherProps } from "../../common/view-mode-switcher.tsx";

export const Header = ({
  value,
  setValue,
  viewMode,
  setViewMode,
}: {
  value: string;
  setValue: (value: string) => void;
  viewMode: ViewModeSwitcherProps["viewMode"];
  setViewMode: (viewMode: ViewModeSwitcherProps["viewMode"]) => void;
}) => {
  return (
    <ListPageHeader
      input={{
        placeholder: "Search prompt",
        value: value,
        onChange: (e) => setValue(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
    />
  );
};
