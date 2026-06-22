"use client";

import { useState, useRef, useEffect } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useCurrentUserProfile,
  useUpdateCurrentUserProfile,
  useUploadUserPhoto,
} from "@/services/users/hooks";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage, type Language } from "@/lib/i18n/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { Camera, Globe, User, ShieldCheck, Mail, Phone } from "iconoir-react";

// ─────────────────────────────────────────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2E] bg-[#141416] p-6">
      <div className="mb-6 flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-text-muted">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────

function AvatarRow({
  user,
}: {
  user: {
    first_name: string;
    last_name: string;
    email: string;
    profile_picture?: string | null;
  };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadUserPhoto();

  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto.mutate(file, {
      onSuccess: () => toast.success("Photo updated"),
      onError: () => toast.error("Failed to update photo"),
    });
  }

  return (
    <div className="mb-6 flex items-center gap-5">
      <div className="relative shrink-0">
        {user.profile_picture ? (
          <Image
            src={user.profile_picture}
            alt={`${user.first_name} ${user.last_name}`}
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-full object-cover border-2 border-[#2A2A2E]"
          />
        ) : (
          <div className="h-[72px] w-[72px] rounded-full bg-[#232327] border-2 border-[#2A2A2E] flex items-center justify-center text-2xl font-semibold text-text-muted select-none">
            {initials}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadPhoto.isPending}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#2A2A2E] bg-[#1C1C1F] text-text-muted transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
          title="Change photo"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <div>
        <p className="text-base font-semibold text-text-primary">
          {user.first_name} {user.last_name}
        </p>
        <p className="text-sm text-text-muted">{user.email}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal info form
// ─────────────────────────────────────────────────────────────────────────────

function PersonalInfoSection({
  user,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUserProfile>["data"]>;
}) {
  const updateProfile = useUpdateCurrentUserProfile();
  const [form, setForm] = useState({
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    job_title: user.job_title ?? "",
    phone: user.phone ?? "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      job_title: user.job_title ?? "",
      phone: user.phone ?? "",
    });
  }, [user.first_name, user.last_name, user.job_title, user.phone]);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  function handleSave() {
    updateProfile.mutate(form, {
      onSuccess: () => {
        toast.success("Profile updated");
        setDirty(false);
      },
      onError: () => toast.error("Failed to save changes"),
    });
  }

  return (
    <Section
      title="Personal Information"
      description="Your name, title, and contact details."
      icon={<User className="h-4 w-4" />}
    >
      <AvatarRow user={user} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          value={form.first_name}
          onChange={(e) => handleChange("first_name", e.target.value)}
          placeholder="First name"
        />
        <Input
          label="Last name"
          value={form.last_name}
          onChange={(e) => handleChange("last_name", e.target.value)}
          placeholder="Last name"
        />
        <Input
          label="Job title"
          value={form.job_title}
          onChange={(e) => handleChange("job_title", e.target.value)}
          placeholder="e.g. Head Chef"
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="+1 555 000 0000"
          type="tel"
        />
      </div>

      {dirty && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Language section
// ─────────────────────────────────────────────────────────────────────────────

function LanguageSection() {
  const { language, setLanguage } = useLanguage();
  const updateProfile = useUpdateCurrentUserProfile();
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved">("idle");

  function handleChange(lang: Language) {
    setLanguage(lang);
    setSyncStatus("saving");
    updateProfile.mutate(
      { preferred_language: lang },
      {
        onSuccess: () => {
          setSyncStatus("saved");
          setTimeout(() => setSyncStatus("idle"), 2500);
        },
        onError: () => {
          toast.error("Could not save language preference");
          setSyncStatus("idle");
        },
      },
    );
  }

  return (
    <Section
      title="Language"
      description="Choose the language for the interface, API messages, and email notifications."
      icon={<Globe className="h-4 w-4" />}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            Current:{" "}
            <span className="font-medium text-text-primary">
              {language === "fr" ? "Français" : "English"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Saved to your account and applied on all devices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher onChange={handleChange} />
          {syncStatus === "saving" && (
            <span className="text-xs text-text-muted">Saving…</span>
          )}
          {syncStatus === "saved" && (
            <span className="text-xs font-medium text-[#3F8F68]">Saved</span>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account status section
// ─────────────────────────────────────────────────────────────────────────────

function AccountSection({
  user,
}: {
  user: {
    email: string;
    is_verified: boolean;
    phone?: string | null;
    phone_verified?: boolean;
  };
}) {
  return (
    <Section
      title="Account"
      description="Your credentials and verification status."
      icon={<ShieldCheck className="h-4 w-4" />}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">{user.email}</p>
              <p className="text-xs text-text-muted">Email address</p>
            </div>
          </div>
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              user.is_verified
                ? "bg-[#3F8F68]/15 text-[#3F8F68]"
                : "bg-[#C44949]/15 text-[#C44949]"
            }`}
          >
            {user.is_verified ? "Verified" : "Unverified"}
          </span>
        </div>

        {user.phone && (
          <div className="flex items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">{user.phone}</p>
                <p className="text-xs text-text-muted">Phone number</p>
              </div>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                user.phone_verified
                  ? "bg-[#3F8F68]/15 text-[#3F8F68]"
                  : "bg-[#C44949]/15 text-[#C44949]"
              }`}
            >
              {user.phone_verified ? "Verified" : "Unverified"}
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: user, isLoading } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow="Account"
      title="My Profile"
      description="Manage your personal information, language preference, and account settings."
      insight="Keeping your profile accurate helps your team identify and reach you quickly."
    >
      {isLoading || !user ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-[#2A2A2E] bg-[#141416] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <PersonalInfoSection user={user} />
          <LanguageSection />
          <AccountSection user={user} />
        </div>
      )}
    </WorkspaceShell>
  );
}
