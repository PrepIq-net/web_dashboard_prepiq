"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  EyeClosed,
  Lock,
  Mail,
  Phone,
  User,
  UserBag,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { Honeypot } from "@/components/auth/honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { useRegisterUser } from "@/services";

const JOB_TITLE_OPTIONS = [
  { value: "ORG_OWNER", label: "Organization Owner" },
  { value: "OPS_DIRECTOR", label: "Operations Director" },
  { value: "ORG_ADMIN", label: "Organization Admin" },
  { value: "GM", label: "General Manager" },
  { value: "BRANCH_MANAGER", label: "Branch Manager" },
  { value: "STAFF_OPERATOR", label: "Staff Operator" },
  { value: "AUDITOR", label: "Auditor / Read Only" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(""); // Starts empty
  const [jobTitle, setJobTitle] = useState("");
  const [nickname, setNickname] = useState(""); // Honeypot field

  const registerMutation = useRegisterUser();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Honeypot check
    if (nickname) {
      console.log("Bot detected via honeypot.");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim() ? phone.trim() : undefined,
        job_title: jobTitle.trim() ? jobTitle.trim() : undefined,
      });

      toast.success("Account created. Please verify your email.");
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create account.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted">Setting up</p>
          </div>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-12 animate-fade-in">
            <div className="space-y-3 text-center">
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                Create your account.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed max-w-lg mx-auto">
                Sign up to start managing your kitchen operations with smart
                insights and clear actions.
              </p>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <Honeypot
                name="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <Input
                  label="First Name"
                  type="text"
                  placeholder="e.g. Marcus"
                  leadingIcon={<User />}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  className="text-lg"
                />
                <Input
                  label="Last Name"
                  type="text"
                  placeholder="e.g. Holloway"
                  leadingIcon={<User />}
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  className="text-lg"
                />
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <Input
                  label="Work Email"
                  type="email"
                  placeholder="name@organization.com"
                  leadingIcon={<Mail />}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="text-lg"
                />
                <Input
                  label="Secure Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  leadingIcon={<Lock />}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="text-lg"
                  trailingIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="inline-flex items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeClosed /> : <Eye />}
                    </button>
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <PhoneInput
                  label="Contact Phone"
                  value={phone}
                  onChange={setPhone}
                  className="text-lg"
                />
                <Select
                  label="Your Position"
                  placeholder="Select your position"
                  options={JOB_TITLE_OPTIONS}
                  leadingIcon={<UserBag />}
                  value={jobTitle}
                  onChange={setJobTitle}
                  className="text-lg"
                />
              </div>

              <div className="py-4 border-y border-border-default/30">
                <p className="text-xs text-text-muted leading-relaxed text-center">
                  By clicking &ldquo;Create Account&rdquo; you agree to the
                  PrepIQ{" "}
                  <Link
                    href="/terms"
                    className="text-brand-gold hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-brand-gold hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>

              <div className="space-y-6">
                <Button
                  type="submit"
                  fullWidth
                  disabled={registerMutation.isPending}
                  className="py-7 text-base font-semibold shadow-level-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {registerMutation.isPending
                    ? "Creating Account..."
                    : "Create Account"}
                </Button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-border-default/50" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">
                    Or sign up with
                  </span>
                  <div className="h-px flex-1 bg-border-default/50" />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="py-7 border-border-default/50 hover:bg-surface-3 transition-all"
                  leftIcon={
                    <Image
                      src="/app_logo/logo-google.png"
                      alt="Google"
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px]"
                    />
                  }
                >
                  Continue with Google
                </Button>
              </div>
            </form>

            <p className="text-center text-sm text-text-secondary pt-8">
              Already have access?{" "}
              <Link
                href="/login"
                className="font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50 flex justify-between items-center">
          <p className="text-xs text-text-muted">
            PrepIQ Infrastructure &copy; 2026.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
