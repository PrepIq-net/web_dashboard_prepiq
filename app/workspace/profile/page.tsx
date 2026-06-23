"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useCurrentUserProfile,
  useUpdateCurrentUserProfile,
  useUploadUserPhoto,
  useChangePassword,
} from "@/services/users/hooks";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage, type Language } from "@/lib/i18n/language-context";
import { useTranslation } from "@/lib/i18n";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import Image from "next/image";
import {
  Camera,
  Globe,
  User,
  ShieldCheck,
  Mail,
  Phone,
  EyeClosed,
  Eye,
  ArrowRight,
} from "iconoir-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProfileTab = "general" | "security";

// ─────────────────────────────────────────────────────────────────────────────
// Section card
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
// Avatar with crop
// ─────────────────────────────────────────────────────────────────────────────

function AvatarWithCrop({
  user,
}: {
  user: { first_name: string; last_name: string; email: string; profile_picture?: string | null };
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadUserPhoto();
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  function handleCropComplete(blob: Blob) {
    setCropSrc(null);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    uploadPhoto.mutate(file, {
      onSuccess: () => toast.success(t("profile.personalInfo.saved")),
      onError: () => toast.error(t("profile.personalInfo.saveFailed")),
    });
  }

  return (
    <>
      {cropSrc && (
        <ImageCropper
          image={cropSrc}
          aspect={1}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="mb-6 flex items-center gap-5">
        <div className="relative shrink-0">
          {user.profile_picture ? (
            <Image
              src={user.profile_picture}
              alt={`${user.first_name} ${user.last_name}`}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover border-2 border-[#2A2A2E]"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[#232327] border-2 border-[#2A2A2E] flex items-center justify-center text-2xl font-semibold text-text-muted select-none">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadPhoto.isPending}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#2A2A2E] bg-[#1C1C1F] text-text-muted transition-all hover:border-brand-gold/60 hover:bg-[#232327] hover:text-brand-gold disabled:opacity-50"
            title={t("profile.personalInfo.changePhoto")}
          >
            {uploadPhoto.isPending ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#2A2A2E] border-t-brand-gold" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-sm text-text-muted">{user.email}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-1.5 text-[11px] font-medium text-brand-gold hover:text-brand-gold/80 transition-colors"
          >
            {t("profile.personalInfo.changePhoto")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// General tab
// ─────────────────────────────────────────────────────────────────────────────

function GeneralTab({
  user,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUserProfile>["data"]>;
}) {
  const { t } = useTranslation();
  const updateProfile = useUpdateCurrentUserProfile();
  const { language, setLanguage } = useLanguage();
  const [form, setForm] = useState({
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    job_title: user.job_title ?? "",
    phone: user.phone ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [langSyncStatus, setLangSyncStatus] = useState<"idle" | "saving" | "saved">("idle");

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
        toast.success(t("profile.personalInfo.saved"));
        setDirty(false);
      },
      onError: () => toast.error(t("profile.personalInfo.saveFailed")),
    });
  }

  function handleLangChange(lang: Language) {
    setLanguage(lang);
    setLangSyncStatus("saving");
    updateProfile.mutate(
      { preferred_language: lang },
      {
        onSuccess: () => {
          toast.success(t("profile.language.updated"));
          setLangSyncStatus("saved");
          setTimeout(() => setLangSyncStatus("idle"), 2500);
        },
        onError: () => {
          toast.error(t("profile.language.saveFailed"));
          setLangSyncStatus("idle");
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Personal info */}
      <Section
        title={t("profile.personalInfo.title")}
        description={t("profile.personalInfo.description")}
        icon={<User className="h-4 w-4" />}
      >
        <AvatarWithCrop user={user} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("profile.personalInfo.firstName")}
            value={form.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            placeholder={t("profile.personalInfo.firstName")}
          />
          <Input
            label={t("profile.personalInfo.lastName")}
            value={form.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            placeholder={t("profile.personalInfo.lastName")}
          />
          <Input
            label={t("profile.personalInfo.jobTitle")}
            value={form.job_title}
            onChange={(e) => handleChange("job_title", e.target.value)}
            placeholder={t("profile.personalInfo.jobTitlePlaceholder")}
          />
          <Input
            label={t("profile.personalInfo.phone")}
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder={t("profile.personalInfo.phonePlaceholder")}
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
              {updateProfile.isPending ? t("profile.personalInfo.saving") : t("profile.personalInfo.save")}
            </Button>
          </div>
        )}
      </Section>

      <Section
        title={t("profile.language.title")}
        description={t("profile.language.description")}
        icon={<Globe className="h-4 w-4" />}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-secondary">
              {t("profile.language.current")}{" "}
              <span className="font-medium text-text-primary">
                {language === "fr" ? t("profile.language.french") : t("profile.language.english")}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {t("profile.language.syncedNote")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher onChange={handleLangChange} />
            {langSyncStatus === "saving" && (
              <span className="text-xs text-text-muted">{t("profile.language.saving")}</span>
            )}
            {langSyncStatus === "saved" && (
              <span className="text-xs font-medium text-[#3F8F68]">{t("profile.language.saved")}</span>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Security tab
// ─────────────────────────────────────────────────────────────────────────────

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        trailingIcon={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="text-text-muted hover:text-text-secondary"
          >
            {visible ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
    </div>
  );
}

function SecurityTab({
  user,
}: {
  user: {
    email: string;
    is_verified: boolean;
    phone?: string | null;
    phone_verified?: boolean;
  };
}) {
  const { t } = useTranslation();
  const changePassword = useChangePassword();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error(t("profile.security.passwordMismatch"));
      return;
    }
    if (form.new_password.length < 8) {
      toast.error(t("profile.security.passwordTooShort"));
      return;
    }
    changePassword.mutate(
      {
        current_password: form.current_password,
        new_password: form.new_password,
      },
      {
        onSuccess: () => {
          toast.success(t("profile.security.passwordUpdated"));
          setForm({ current_password: "", new_password: "", confirm_password: "" });
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message ?? t("profile.security.passwordUpdated");
          toast.error(msg);
        },
      },
    );
  }

  const allFilled =
    form.current_password.length > 0 &&
    form.new_password.length > 0 &&
    form.confirm_password.length > 0;

  return (
    <div className="space-y-4">
      {/* Change password */}
      <Section
        title={t("profile.security.changePasswordTitle")}
        description={t("profile.security.changePasswordDescription")}
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label={t("profile.security.currentPassword")}
            value={form.current_password}
            onChange={(v) => handleChange("current_password", v)}
            placeholder={t("profile.security.currentPasswordPlaceholder")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label={t("profile.security.newPassword")}
              value={form.new_password}
              onChange={(v) => handleChange("new_password", v)}
              placeholder={t("profile.security.newPasswordPlaceholder")}
            />
            <PasswordField
              label={t("profile.security.confirmPassword")}
              value={form.confirm_password}
              onChange={(v) => handleChange("confirm_password", v)}
              placeholder={t("profile.security.confirmPasswordPlaceholder")}
            />
          </div>

          {form.new_password && form.confirm_password && form.new_password !== form.confirm_password && (
            <p className="text-[12px] text-[#C44949]">{t("profile.security.passwordMismatch")}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={!allFilled || changePassword.isPending}
            >
              {changePassword.isPending ? t("profile.security.updating") : t("profile.security.updatePassword")}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title={t("profile.security.accountStatusTitle")}
        description={t("profile.security.accountStatusDescription")}
        icon={<Mail className="h-4 w-4" />}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-text-muted" />
              <div>
                <p className="text-sm font-medium text-text-primary">{user.email}</p>
                <p className="text-xs text-text-muted">{t("profile.security.emailAddress")}</p>
              </div>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                user.is_verified
                  ? "bg-[#3F8F68]/15 text-[#3F8F68]"
                  : "bg-[#C44949]/15 text-[#C44949]"
              }`}
            >
              {user.is_verified ? t("profile.security.verified") : t("profile.security.unverified")}
            </span>
          </div>

          {user.phone && (
            <div className="flex items-center justify-between rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-text-muted" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{user.phone}</p>
                  <p className="text-xs text-text-muted">{t("profile.security.phoneNumber")}</p>
                </div>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  user.phone_verified
                    ? "bg-[#3F8F68]/15 text-[#3F8F68]"
                    : "bg-[#C44949]/15 text-[#C44949]"
                }`}
              >
                {user.phone_verified ? t("profile.security.verified") : t("profile.security.unverified")}
              </span>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<ProfileTab>("general");

  const TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("profile.tab.general"), icon: <User className="h-4 w-4" /> },
    { id: "security", label: t("profile.tab.security"), icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <WorkspaceShell
      eyebrow={t("profile.eyebrow")}
      title={t("profile.title")}
      description={t("profile.description")}
      insight={t("profile.insight")}
    >
      {isLoading || !user ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-[#2A2A2E] bg-[#141416] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 mt-4">
          {/* Tab sidebar */}
          <aside className="w-full md:w-56 shrink-0">
            <nav className="flex flex-col space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-[#1C1C1F] text-brand-gold shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-[#2A2A2E]"
                      : "text-text-secondary hover:bg-[#1C1C1F]/50 hover:text-text-primary"
                  }`}
                >
                  <span className={activeTab === tab.id ? "text-brand-gold" : "text-text-muted"}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Tab content */}
          <div className="flex-1 min-w-0">
            {activeTab === "general" && <GeneralTab user={user} />}
            {activeTab === "security" && <SecurityTab user={user} />}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
