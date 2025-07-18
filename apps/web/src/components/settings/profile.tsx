// deno-lint-ignore-file no-explicit-any
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { UserAvatar } from "../common/avatar/user.tsx";
import { countries } from "@deco/sdk/utils" with { type: "json" };
import { useProfile, useUpdateProfile } from "@deco/sdk/hooks";
import { useUser } from "../../hooks/use-user.ts";

export interface Country {
  code: string;
  name: string;
  flag: string;
  dial_code: string;
  meta_code?: string;
  mask: (value: string) => string;
  validate: (value: string) => boolean;
  placeholder: string;
}

function getCountryConfig(country: any): Country {
  if (country.dial_code === "+55") {
    return {
      ...country,
      mask: (value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.length > 11) digits = digits.slice(0, 11);
        if (digits.length === 11) {
          return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(
            7,
          )}`;
        } else if (digits.length > 2) {
          return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        } else if (digits.length > 0) {
          return `(${digits}`;
        }
        return "";
      },
      validate: (value: string) =>
        /^\+?55\d{11}$/.test(value.replace(/\D/g, "")),
      placeholder: "+55119100000000",
    };
  }
  if (country.dial_code === "+1") {
    return {
      ...country,
      mask: (value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.length > 10) digits = digits.slice(0, 10);
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
            6,
          )}`;
        } else if (digits.length > 3) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        } else if (digits.length > 0) {
          return `(${digits}`;
        }
        return "";
      },
      validate: (value: string) =>
        /^\+?1\d{10}$/.test(value.replace(/\D/g, "")),
      placeholder: "+14155551234",
    };
  }
  return {
    ...country,
    mask: (value: string) => value.replace(/\D/g, "").slice(0, 15),
    validate: (value: string) => value.replace(/\D/g, "").length > 0,
    placeholder: `${country.dial_code} ...`,
  };
}

const COUNTRIES: Country[] = countries.map(getCountryConfig);

export function ProfileSettings({
  open,
  onOpenChange,
  onPhoneSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhoneSaved?: () => void;
}) {
  const { data: profile, isLoading, error: loadError } = useProfile();
  const user = useUser();
  const updateProfile = useUpdateProfile();
  const [dialCode, setDialCode] = useState("+1"); // default to US/Canada
  const [localValue, setLocalValue] = useState(""); // masked local number for display
  const [country, setCountry] = useState<Country | null>(null);
  const [fullPhone, setFullPhone] = useState(""); // full international number for saving
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);

  function handleSave() {
    updateProfile.mutate(
      { phone: fullPhone },
      {
        onSuccess: () => {
          setSuccess(true);
          if (onPhoneSaved) onPhoneSaved();
        },
        onError: (err: any) =>
          setError(err.message || "Failed to update profile"),
      },
    );
  }

  function handleCopyUserId() {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setUserIdCopied(true);
      setTimeout(() => setUserIdCopied(false), 3000);
    }
  }

  // On load, parse phone
  useEffect(() => {
    if (profile?.phone) {
      // Find country by dial_code
      const match = COUNTRIES.find((c) =>
        profile.phone?.startsWith(c.dial_code),
      );
      setCountry(match || null);
      if (match) {
        setDialCode(match.dial_code);
        const local = profile.phone.slice(match.dial_code.length);
        setLocalValue(match.mask(local));
        setFullPhone(profile.phone);
      } else {
        setDialCode("+");
        setLocalValue(profile.phone);
        setFullPhone(profile.phone);
      }
    }
  }, [profile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Your account information</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        ) : loadError ? (
          <div className="py-8 text-center text-destructive">
            {String(loadError.message)}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <UserAvatar
              url={profile?.metadata?.avatar_url}
              fallback={profile?.metadata?.full_name || profile?.email}
              size="2xl"
            />
            <div className="text-lg font-semibold">
              {profile?.metadata?.full_name || profile?.email}
            </div>
            <div className="text-sm text-muted-foreground">
              {profile?.email}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>User ID: {user?.id}</span>
              <button
                type="button"
                onClick={handleCopyUserId}
                className="p-1 hover:bg-muted rounded transition-colors"
                aria-label="Copy user ID"
              >
                <Icon
                  name={userIdCopied ? "check" : "content_copy"}
                  size={12}
                />
              </button>
            </div>
            <PhoneInput
              dialCode={dialCode}
              country={country}
              localValue={localValue}
              setDialCode={setDialCode}
              setCountry={setCountry}
              setLocalValue={setLocalValue}
              setFullPhone={setFullPhone}
              setError={setError}
              isDisabled={updateProfile.isPending}
              fullPhone={fullPhone}
            />
            {error && (
              <span className="text-destructive text-xs mt-1">{error}</span>
            )}
            {success && (
              <span className="text-special text-xs mt-1">Saved!</span>
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={updateProfile.isPending || isLoading}
          >
            {updateProfile.isPending ? "Saving..." : "Save"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PhoneInput({
  setDialCode,
  setCountry,
  setLocalValue,
  setFullPhone,
  setError,
  dialCode,
  country,
  localValue,
  fullPhone,
  isDisabled,
}: {
  setDialCode: (dialCode: string) => void;
  setCountry: (country: Country | null) => void;
  setLocalValue: (localValue: string) => void;
  setFullPhone: (fullPhone: string) => void;
  setError: (error: string) => void;
  dialCode: string;
  country: Country | null;
  localValue: string;
  fullPhone: string;
  isDisabled: boolean;
}) {
  function validatePhone() {
    if (!country) {
      setError(
        "Please enter a valid international phone number (e.g. +5511910000000)",
      );
      return false;
    }
    if (!country.validate(fullPhone)) {
      setError(`Please enter a valid phone number for ${country.name}`);
      return false;
    }
    setError("");
    return true;
  }

  function handleDialCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formattedRaw = !raw.startsWith("+")
      ? "+" + raw.replace(/\D/g, "")
      : raw;
    setDialCode(formattedRaw);
    const match = COUNTRIES?.find(
      (c) =>
        formattedRaw === c.dial_code || formattedRaw.startsWith(c.dial_code),
    );

    setCountry(match || null);
    // Reset local value if country changes
    setLocalValue("");
    setFullPhone(formattedRaw);
    setError("");
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    const masked = country ? country.mask(digits) : raw;
    setLocalValue(masked);
    setFullPhone(dialCode + digits);
    setError("");
  }

  return (
    <div className="w-full max-w-xs flex flex-col gap-2">
      <label
        htmlFor="profile-phone"
        className="text-sm font-medium text-muted-foreground"
      >
        Phone Number
      </label>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{country?.flag ?? "🌐"}</span>
        <input
          id="profile-dialcode"
          type="text"
          className="border rounded px-2 py-2 text-sm w-20 text-center"
          placeholder="+55"
          value={dialCode}
          onChange={handleDialCodeChange}
          maxLength={5}
          inputMode="tel"
          autoComplete="tel-country-code"
          disabled={isDisabled}
        />
        <input
          id="profile-local"
          type="tel"
          className="border rounded px-3 py-2 text-sm flex-1"
          placeholder={
            country?.placeholder?.replace(country.dial_code, "") ??
            "11910000000"
          }
          value={localValue}
          onChange={handleLocalChange}
          onBlur={validatePhone}
          maxLength={20}
          inputMode="tel"
          autoComplete="tel-local"
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
