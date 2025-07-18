import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

interface Role {
  id: number;
  name: string;
}

interface RolesDropdownProps {
  roles: Role[];
  selectedRoles: Role[] | string[];
  onRoleClick: (role: Role, checked: boolean) => void;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}

export function RolesDropdown({
  roles,
  selectedRoles,
  onRoleClick,
  disabled = false,
  triggerClassName,
  contentClassName,
}: RolesDropdownProps) {
  const isRoleSelected = (role: Role) => {
    if (Array.isArray(selectedRoles) && selectedRoles.length > 0) {
      // Handle both Role objects and string IDs
      if (typeof selectedRoles[0] === "string") {
        return (selectedRoles as string[]).includes(role.id.toString());
      } else {
        return (selectedRoles as Role[]).some(
          (selectedRole) => selectedRole.id === role.id,
        );
      }
    }
    return false;
  };

  const handleRoleClick = (role: Role, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const checked = isRoleSelected(role);

    // Don't allow removing the last role unless allowEmpty is true
    if (checked && selectedRoles.length <= 1) {
      toast.error("Member must have at least one role");
      return;
    }

    onRoleClick(role, !checked);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-5.5 w-5.5 p-0 rounded-md ${triggerClassName || ""}`}
          disabled={disabled}
        >
          <Icon name="add" size={14} />
          <span className="sr-only">Manage roles</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={`w-56 p-2 ${contentClassName || ""}`}
      >
        <div className="text-xs font-medium px-2 py-1.5">Roles</div>
        {roles.map((role) => {
          const checked = isRoleSelected(role);
          return (
            <DropdownMenuCheckboxItem
              checked={checked}
              disabled={disabled}
              onSelect={(e) => e.preventDefault()}
              onClick={(e) => handleRoleClick(role, e)}
            >
              <span className="capitalize">{role.name}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
