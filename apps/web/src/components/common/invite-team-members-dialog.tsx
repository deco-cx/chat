import type React from "react";
import {
  cloneElement,
  type MouseEventHandler,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v3";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Protect } from "../wallet/plan.tsx";
import { useContactUsUrl } from "../../hooks/use-contact-us.ts";
import { Badge } from "@deco/ui/components/badge.tsx";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";

// Form validation schema - simplified for email tags approach
const inviteMemberSchema = z.object({
  emails: z
    .array(z.string().email("Invalid email address"))
    .min(1, "At least one email is required"),
  roleId: z.array(z.string()).min(1, { message: "Please select a role" }),
});

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

// Email validation regex (same as before)
// const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const emailSchema = z.string().email("Invalid email address");

// Email validation types
type EmailValidationState = "valid" | "invalid" | "self";

// Custom Badge component with specific styling
function CustomBadge({
  children,
  variant,
  className,
  ...props
}: React.ComponentProps<typeof Badge>) {
  const customClasses = cn(
    // Base styles with reduced padding
    "inline-flex items-center justify-center rounded-full border text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden",
    // Custom padding - 4px instead of 8px
    "px-1 py-0.5", // px-1 = 4px, py-0.5 = 2px
    // Variant specific styles
    variant === "destructive"
      ? "bg-background border-destructive text-destructive [a&]:hover:bg-destructive/5"
      : variant === "secondary"
        ? "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90"
        : "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
    className,
  );

  return (
    <span className={customClasses} {...props}>
      {children}
    </span>
  );
}

// Email tags input component using textarea
interface EmailTagsInputProps {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  currentUserEmail?: string;
}

function EmailTagsInput({
  emails,
  onEmailsChange,
  disabled,
  placeholder,
  currentUserEmail,
}: EmailTagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [emailStates, setEmailStates] = useState<
    Map<string, EmailValidationState>
  >(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const validateEmail = (email: string): EmailValidationState => {
    const trimmedEmail = email.trim().toLowerCase();

    if (currentUserEmail && trimmedEmail === currentUserEmail.toLowerCase()) {
      return "self";
    }

    if (!emailSchema.safeParse(trimmedEmail).success) {
      return "invalid";
    }

    return "valid";
  };

  const addEmail = useCallback(
    (email: string) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) return false;

      // Check if email already exists
      if (emails.includes(trimmedEmail)) {
        return false;
      }

      // Validate email
      const state = validateEmail(trimmedEmail);

      // Add email regardless of validation state (so user can see error)
      const newEmails = [...emails, trimmedEmail];
      onEmailsChange(newEmails);

      // Update validation state
      setEmailStates((prev) => {
        const next = new Map(prev);
        next.set(trimmedEmail, state);
        return next;
      });

      return true;
    },
    [emails, onEmailsChange, currentUserEmail],
  );

  const removeEmail = useCallback(
    (emailToRemove: string) => {
      const newEmails = emails.filter((email) => email !== emailToRemove);
      onEmailsChange(newEmails);

      // Remove from validation states
      setEmailStates((prev) => {
        const next = new Map(prev);
        next.delete(emailToRemove);
        return next;
      });
    },
    [emails, onEmailsChange],
  );

  const processEmailList = useCallback(
    (text: string) => {
      // Split by various delimiters, clean up and filter empty strings
      const potentialEmails = text
        .split(/[,;\n\r\t|]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      let addedCount = 0;
      let totalEmails = 0;
      const newEmailsToAdd: string[] = [];
      const newEmailStates = new Map<string, EmailValidationState>();

      potentialEmails.forEach((email) => {
        totalEmails++;
        const trimmedEmail = email.trim().toLowerCase();

        // Skip if email already exists in current list or in new emails to add
        if (
          emails.includes(trimmedEmail) ||
          newEmailsToAdd.includes(trimmedEmail)
        ) {
          return;
        }

        // Validate email
        const state = validateEmail(trimmedEmail);

        // Add to our list regardless of validation state (so user can see errors)
        newEmailsToAdd.push(trimmedEmail);
        newEmailStates.set(trimmedEmail, state);
        addedCount++;
      });

      // Update all emails at once to avoid race conditions
      if (newEmailsToAdd.length > 0) {
        const allEmails = [...emails, ...newEmailsToAdd];
        onEmailsChange(allEmails);

        // Update validation states
        setEmailStates((prev) => {
          const next = new Map(prev);
          newEmailStates.forEach((state, email) => {
            next.set(email, state);
          });
          return next;
        });
      }

      // Only clear input if we actually processed emails from it
      if (totalEmails > 0) {
        setInputValue("");

        if (addedCount > 0) {
          toast.success(
            `Added ${addedCount} email${addedCount > 1 ? "s" : ""}`,
          );
        } else if (totalEmails > addedCount) {
          // Some emails were not added (duplicates or invalid)
          toast.info(
            `${totalEmails - addedCount} email${
              totalEmails - addedCount > 1 ? "s were" : " was"
            } already added or invalid`,
          );
        }
      }

      return addedCount;
    },
    [emails, onEmailsChange, validateEmail],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    // Check if there are delimiters in the current input
    const hasDelimiters = /[,;\n\r\t|]/.test(value);

    if (hasDelimiters) {
      // Process the emails
      processEmailList(value);
    } else {
      // No delimiters, just update the input value
      setInputValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        if (addEmail(inputValue)) {
          setInputValue("");
        }
      }
    } else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      // Remove last email when backspace is pressed on empty input
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");

    // Always process pasted content for emails
    if (pastedText.trim()) {
      e.preventDefault();

      // If pasted text contains delimiters, process as email list
      if (/[,;\n\r\t|]/.test(pastedText)) {
        processEmailList(pastedText);
      } else {
        // Single email, add it
        if (addEmail(pastedText.trim())) {
          // Don't clear input here, let normal flow handle it
        } else {
          // Failed to add, put it in input for user to see/edit
          setInputValue(pastedText.trim());
        }
      }
    }
  };

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height =
        Math.max(96, Math.min(200, textarea.scrollHeight)) + "px"; // Min 4 lines (24px * 4 = 96px)
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Get error messages for display
  const invalidEmails = emails.filter(
    (email) => emailStates.get(email) === "invalid",
  );
  const selfEmails = emails.filter(
    (email) => emailStates.get(email) === "self",
  );

  const getBadgeVariant = (email: string) => {
    const state = emailStates.get(email);
    switch (state) {
      case "invalid":
      case "self":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={() => textareaRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-1 items-start">
          {emails.map((email) => (
            <CustomBadge
              key={email}
              variant={getBadgeVariant(email)}
              className="flex items-center gap-1 max-w-xs"
            >
              <span className="truncate">{email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-4 w-4 rounded-full transition-colors",
                  getBadgeVariant(email) === "destructive"
                    ? "text-destructive hover:text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  removeEmail(email);
                }}
                disabled={disabled}
              >
                <Icon name="close" size={12} />
              </Button>
            </CustomBadge>
          ))}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground overflow-hidden"
            placeholder={
              emails.length === 0 ? placeholder : "Add more emails..."
            }
            disabled={disabled}
            rows={4}
            style={{
              minHeight: "96px", // 4 lines minimum
              maxHeight: "200px",
            }}
          />
        </div>
      </div>

      {/* Show validation errors */}
      {selfEmails.length > 0 && (
        <div className="text-sm text-destructive">
          You're not able to send an invite to yourself: {selfEmails.join(", ")}
        </div>
      )}

      {invalidEmails.length > 0 && (
        <div className="text-sm text-destructive">
          Invalid email format: {invalidEmails.join(", ")}
        </div>
      )}
    </div>
  );
}

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
          <Button variant="outline" type="button">
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
  const user = useUser();

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

  // Find collaborator role as default (instead of owner)
  const collaboratorRoleId = useMemo(() => {
    const collaboratorRole = roles.find(
      (role) => role.name.toLowerCase() === "collaborator",
    );
    return collaboratorRole?.id.toString() || "";
  }, [roles]);

  // Custom schema that doesn't show "At least one email is required" error
  const customInviteMemberSchema = z.object({
    emails: z.array(z.string()),
    roleId: z.array(z.string()).min(1, { message: "Please select a role" }),
  });

  const form = useForm<{ emails: string[]; roleId: string[] }>({
    resolver: zodResolver(customInviteMemberSchema),
    mode: "onChange", // Changed to onChange for better validation feedback
    defaultValues: {
      emails: [],
      roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
    },
  });

  useEffect(() => {
    if (collaboratorRoleId) {
      form.setValue("roleId", [collaboratorRoleId]);
    }
  }, [collaboratorRoleId, form]);

  // Watch form values for better reactivity
  const emails = form.watch("emails");
  const roleIds = form.watch("roleId");

  // Filter valid emails for submission
  const validEmails = useMemo(() => {
    return emails.filter((email) => {
      const trimmedEmail = email.trim().toLowerCase();

      const isValidFormat = emailSchema.safeParse(trimmedEmail).success;
      const isNotSelf =
        !user?.email || trimmedEmail !== user.email.toLowerCase();
      return isValidFormat && isNotSelf;
    });
  }, [emails, user?.email]);

  // Invite team members
  const handleInviteMembers = async (data: {
    emails: string[];
    roleId: string[];
  }) => {
    if (!teamId) return;

    if (validEmails.length === 0) {
      toast.error("Please add at least one valid email address");
      return;
    }

    try {
      // Transform data for API call - only use valid emails
      const invitees = validEmails.map((email) => ({
        email,
        roles: data.roleId.map((id) => ({
          id: Number(id),
          name: roles.find((r) => r.id === Number(id))?.name || "",
        })),
      }));

      // Call API to invite members
      await inviteMemberMutation.mutateAsync({
        teamId,
        invitees,
      });

      // Reset form and close dialog
      form.reset({
        emails: [],
        roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
      });
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
    ? cloneElement(trigger as ReactElement<{ onClick?: MouseEventHandler }>, {
        onClick: openDialog,
      })
    : null;

  // Role options for MultiSelect
  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        label: role.name,
        value: role.id.toString(),
      })),
    [roles],
  );

  // Check if form is valid for submit button - use valid emails count
  const isFormValid = validEmails.length > 0 && roleIds.length > 0;

  return (
    <>
      {wrappedTrigger}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <Protect
          check={(plan) => !plan.isAtSeatLimit}
          fallback={<InviteTeamMembersDialogFeatureWall />}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite members</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleInviteMembers)}
                className="space-y-4"
              >
                <div className="space-y-4">
                  {/* Email Tags Input - no label or description */}
                  <FormField
                    control={form.control}
                    name="emails"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <EmailTagsInput
                            emails={field.value}
                            onEmailsChange={field.onChange}
                            disabled={inviteMemberMutation.isPending}
                            placeholder="Emails, comma separated"
                            currentUserEmail={user?.email}
                          />
                        </FormControl>
                        {/* Don't show FormMessage to avoid "At least one email is required" */}
                      </FormItem>
                    )}
                  />

                  {/* Role Selection using MultiSelect - full width */}
                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MultiSelect
                            options={roleOptions}
                            defaultValue={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select roles"
                            variant="secondary"
                            className="w-full max-w-none"
                            disabled={inviteMemberMutation.isPending}
                            maxCount={99} // Show all tags that fit
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      form.reset({
                        emails: [],
                        roleId: collaboratorRoleId ? [collaboratorRoleId] : [],
                      });
                      setIsOpen(false);
                    }}
                    type="button"
                    disabled={inviteMemberMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending || !isFormValid}
                  >
                    {inviteMemberMutation.isPending
                      ? "Inviting..."
                      : `Invite ${validEmails.length || 0} Member${
                          validEmails.length !== 1 ? "s" : ""
                        }`}
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
