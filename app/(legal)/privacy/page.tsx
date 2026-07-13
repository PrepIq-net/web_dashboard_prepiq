import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { fetchLegalDocument, LANDING_BASE_URL } from "@/lib/legal";

export const metadata = { title: "Privacy Policy — PrepIQ" };

export default async function PrivacyPage() {
  const [en, fr] = await Promise.all([
    fetchLegalDocument("privacy-policy", "en"),
    fetchLegalDocument("privacy-policy", "fr"),
  ]);

  return (
    <LegalDocumentPage
      en={en}
      fr={fr}
      fallbackUrl={`${LANDING_BASE_URL}/privacy-policy`}
    />
  );
}
