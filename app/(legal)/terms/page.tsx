import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { fetchLegalDocument, LANDING_BASE_URL } from "@/lib/legal";

export const metadata = { title: "Terms of Service — PrepIQ" };

export default async function TermsPage() {
  const [en, fr] = await Promise.all([
    fetchLegalDocument("terms-of-service", "en"),
    fetchLegalDocument("terms-of-service", "fr"),
  ]);

  return (
    <LegalDocumentPage
      en={en}
      fr={fr}
      fallbackUrl={`${LANDING_BASE_URL}/terms-of-service`}
    />
  );
}
