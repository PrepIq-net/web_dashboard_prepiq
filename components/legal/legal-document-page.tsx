"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { ArrowLeft } from "iconoir-react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { useLanguage } from "@/lib/i18n/language-context";
import type { LegalDocumentPayload } from "@/lib/legal";

interface LegalDocumentPageProps {
  en: LegalDocumentPayload | null;
  fr: LegalDocumentPayload | null;
  fallbackUrl: string;
}

export function LegalDocumentPage({ en, fr, fallbackUrl }: LegalDocumentPageProps) {
  const { language } = useLanguage();
  const doc = (language === "fr" ? fr : en) ?? en ?? fr;

  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden text-text-primary">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted italic">
              {language === "fr" ? "Cadre Légal" : "Legal Framework"}
            </p>
          </div>
        </header>

        <section className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-12 animate-fade-in">
            <div className="space-y-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold hover:text-brand-gold-hover transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {language === "fr" ? "Retour à l'accès" : "Return to Access"}
              </Link>

              {doc ? (
                <>
                  <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                    {doc.title}
                  </h1>
                  <p className="text-sm text-text-muted">
                    {language === "fr" ? "Dernière mise à jour : " : "Last updated: "}
                    {new Intl.DateTimeFormat(
                      language === "fr" ? "fr-FR" : "en-US",
                      { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
                    ).format(new Date(doc.effectiveDate))}
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
                    {language === "fr" ? "Document indisponible" : "Document unavailable"}
                  </h1>
                  <p className="text-lg text-text-secondary leading-relaxed">
                    {language === "fr"
                      ? "Ce document n'a pas pu être chargé. Vous pouvez le consulter directement sur notre site :"
                      : "This document could not be loaded. You can view it directly on our website:"}{" "}
                    <a
                      href={fallbackUrl}
                      className="text-brand-gold hover:text-brand-gold-hover underline"
                    >
                      {fallbackUrl}
                    </a>
                  </p>
                </div>
              )}
            </div>

            {doc && (
              <div className="space-y-4 text-text-secondary leading-relaxed pb-12">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <div className="space-y-4 pt-8 first:pt-0">
                        <h2 className="text-2xl font-semibold text-text-primary">
                          {children}
                        </h2>
                        <div className="h-0.5 w-12 bg-brand-gold/30 rounded-full" />
                      </div>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-semibold text-text-primary pt-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => <p className="text-base">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 space-y-1.5 text-base">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 space-y-1.5 text-base">
                        {children}
                      </ol>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-text-primary">{children}</strong>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-brand-gold hover:text-brand-gold-hover underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {doc.body}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
