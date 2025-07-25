import type React from "react";
import {
  cloneElement,
  type MouseEventHandler,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useInviteTeamMember, useTeamRoles } from "@deco/sdk";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Protect } from "../wallet/plan.tsx";
import { useContactUsUrl } from "../../hooks/use-contact-us.ts";
import { Badge } from "@deco/ui/components/badge.tsx";
import { RolesDropdown } from "./roles-dropdown.tsx";

// Form validation schema
const inviteMemberSchema = z.object({
  invitees: z.array(
    z.object({
      email: z.string()
        .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
          message:
            "Special characters are not allowed. Only standard ASCII characters are allowed in the email.",
        })
        .email({
          message: "Please enter a valid email address",
        }),
      roleId: z.array(z.string()).min(1, { message: "Please select a role" }),
    }),
  ).min(1),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

function InviteTeamMembersDialogFeatureWall() {
  const contactUsUrl = useContactUsUrl();
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Invite members</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="rounded-full bg-muted p-4 w-16 h-16 flex items-center justify-center">
          <Icon name="lock" className="text-muted-foreground" size={24} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">
            Upgrade Required
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-2/3 mx-auto">
            This team has reached its seat limit. Upgrade your plan to invite
            more members.
          </p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            variant="outline"
            type="button"
          >
            Close
          </Button>
        </DialogClose>
        <Button
          variant="default"
          onClick={() => globalThis.open(contactUsUrl, "_blank")}
          type="button"
        >
          Contact Us
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface InviteTeamMembersDialogProps {
  teamId?: number;
  trigger?: React.ReactNode;
  onComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InviteTeamMembersDialog({
  teamId,
  trigger,
  onComplete,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: InviteTeamMembersDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const openDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      setIsOpen(true);
    }, 50);
  };

  const inviteMemberMutation = useInviteTeamMember();
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const ownerRoleId = useMemo(() => {
    const ownerRole = roles.find((role) => role.name.toLowerCase() === "owner");
    return ownerRole?.id.toString() || "";
  }, [roles]);

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    mode: "onBlur",
    defaultValues: {
      invitees: [{ email: "", roleId: ownerRoleId ? [ownerRoleId] : [] }],
    },
  });

  useEffect(() => {
    if (ownerRoleId) {
      form.setValue("invitees.0.roleId", [ownerRoleId]);
    }
  }, [ownerRoleId, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invitees",
  });

  // Add new invitee
  const handleAddInvitee = () => {
    append({ email: "", roleId: ownerRoleId ? [ownerRoleId] : [] });
  };

  // Remove invitee
  const handleRemoveInvitee = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Invite team members
  const handleInviteMembers = async (data: InviteMemberFormData) => {
    if (!teamId) return;
    try {
      // Transform data for API call
      const invitees = data.invitees.map(({ email, roleId }) => ({
        email,
        roles: roleId.map((id) => (
          {
            id: Number(id),
            name: roles.find((r) => r.id === Number(id))?.name || "",
          }
        )),
      }));

      // Call API to invite members
      await inviteMemberMutation.mutateAsync({
        teamId,
        invitees,
      });

      // Reset form and close dialog
      form.reset();
      setIsOpen(false);
      toast.success(
        invitees.length === 1
          ? "Team member invited successfully!"
          : `${invitees.length} team members invited successfully!`,
      );

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to invite team members:", error);
    }
  };

  // Create a cloned trigger with an onClick handler
  const wrappedTrigger = trigger
    ? cloneElement(
      trigger as ReactElement<{ onClick?: MouseEventHandler }>,
      {
        onClick: openDialog,
      },
    )
    : null;

  return (
    <>
      {wrappedTrigger}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <Protect
          check={(plan) => !plan.isAtSeatLimit}
          fallback={<InviteTeamMembersDialogFeatureWall />}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invite Team Members</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleInviteMembers)}
                className="space-y-6"
              >
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex gap-3 items-start border-b pb-5 mb-2"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name={`invitees.${index}.email`}
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className="shrink-0">Email</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter email address"
                                  {...field}
                                  autoComplete="email"
                                  disabled={inviteMemberMutation.isPending}
                                  className={fieldState.error
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invitees.${index}.roleId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="shrink-0">Role</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-2 h-10">
                                  <span className="inline-flex gap-2 items-center">
                                    {field.value.slice(0, 3).map((roleId) => {
                                      const role = roles.find((r) =>
                                        r.id.toString() === roleId
                                      );
                                      return role
                                        ? (
                                          <Badge variant="outline" key={roleId}>
                                            {role.name}
                                          </Badge>
                                        )
                                        : null;
                                    })}
                                  </span>
                                  <RolesDropdown
                                    roles={roles}
                                    selectedRoles={field.value}
                                    onRoleClick={(role, checked) => {
                                      const currentRoles = field.value || [];
                                      const roleIdStr = role.id.toString();

                                      if (checked) {
                                        // Add role if not already present
                                        if (!currentRoles.includes(roleIdStr)) {
                                          field.onChange([
                                            ...currentRoles,
                                            roleIdStr,
                                          ]);
                                        }
                                      } else {
                                        // Remove role
                                        field.onChange(
                                          currentRoles.filter((id) =>
                                            id !== roleIdStr
                                          ),
                                        );
                                      }
                                    }}
                                    disabled={inviteMemberMutation.isPending}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end mb-1"
                        onClick={() => handleRemoveInvitee(index)}
                        disabled={fields.length <= 1 ||
                          inviteMemberMutation.isPending}
                      >
                        <Icon name="remove" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={handleAddInvitee}
                    disabled={inviteMemberMutation.isPending}
                  >
                    <Icon name="add" className="mr-2" />
                    Add another invitee
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground mt-4 border-t pt-4">
                  Users will receive an invite email to join this team.
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setIsOpen(false);
                    }}
                    type="button"
                    disabled={inviteMemberMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending ||
                      !form.formState.isValid}
                  >
                    {inviteMemberMutation.isPending
                      ? "Inviting..."
                      : "Invite Members"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Protect>
      </Dialog>
    </>
  );
}
