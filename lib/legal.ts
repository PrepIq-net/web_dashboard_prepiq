// Legal documents (privacy, terms, security) are managed in the landing-page
// admin (prepiq.net/admin/legal) and served from its public content API —
// the single source of truth. This app only renders them.

export type LegalLocale = "en" | "fr";

export interface LegalDocumentPayload {
  slug: string;
  locale: LegalLocale;
  title: string;
  version: number;
  effectiveDate: string;
  updatedAt: string;
  format: "markdown";
  body: string;
}

export const LANDING_BASE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "https://prepiq.net";

export async function fetchLegalDocument(
  slug: string,
  locale: LegalLocale
): Promise<LegalDocumentPayload | null> {
  try {
    const res = await fetch(
      `${LANDING_BASE_URL}/api/content/legal/${slug}?locale=${locale}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as LegalDocumentPayload;
  } catch (error) {
    console.error(`Failed to fetch legal document ${slug} (${locale}):`, error);
    return null;
  }
}
