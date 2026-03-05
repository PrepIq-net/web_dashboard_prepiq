export type ParsedCSV = {
  headers: string[];
  rows: string[][];
};

export type CSVColumnMapping = {
  saleDate: string;
  item: string;
  quantity: string;
  revenue?: string;
  unit?: string;
  externalRef?: string;
};

const DATE_ALIASES = ["sale_date", "date", "transaction_date", "sold_at", "timestamp"];
const ITEM_ALIASES = ["item_name", "item", "product", "name", "menu_item", "sku"];
const QUANTITY_ALIASES = ["quantity", "qty", "units_sold", "count"];
const REVENUE_ALIASES = ["gross_revenue", "revenue", "amount", "total", "net_sales", "sales"];
const UNIT_ALIASES = ["unit", "uom"];
const EXTERNAL_REF_ALIASES = ["external_sale_ref", "external_ref", "order_id", "transaction_id", "receipt_id"];

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function escapeCSVCell(value: string): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function parseCSVFile(file: File): Promise<ParsedCSV> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]).map((header) => normalizeHeader(header));
  const rows = lines.slice(1).map((line) => parseCSVLine(line));

  return { headers, rows };
}

function findBestHeader(headers: string[], aliases: string[]): string {
  const normalized = headers.map((header) => normalizeHeader(header));
  for (const alias of aliases) {
    const idx = normalized.findIndex((header) => header === alias);
    if (idx >= 0) return headers[idx];
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex((header) => header.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

export function suggestCSVMapping(headers: string[]): CSVColumnMapping {
  return {
    saleDate: findBestHeader(headers, DATE_ALIASES),
    item: findBestHeader(headers, ITEM_ALIASES),
    quantity: findBestHeader(headers, QUANTITY_ALIASES),
    revenue: findBestHeader(headers, REVENUE_ALIASES),
    unit: findBestHeader(headers, UNIT_ALIASES),
    externalRef: findBestHeader(headers, EXTERNAL_REF_ALIASES),
  };
}

export function buildMappedCSV(parsed: ParsedCSV, mapping: CSVColumnMapping): string {
  const indexByHeader = new Map<string, number>();
  parsed.headers.forEach((header, idx) => {
    indexByHeader.set(header, idx);
  });

  const canonicalHeaders = [
    "sale_date",
    "item_name",
    "pos_external_id",
    "quantity",
    "gross_revenue",
    "unit",
    "external_sale_ref",
  ];

  const mappedRows = parsed.rows.map((row) => {
    const saleDate = row[indexByHeader.get(mapping.saleDate) ?? -1] ?? "";
    const itemValue = row[indexByHeader.get(mapping.item) ?? -1] ?? "";
    const quantity = row[indexByHeader.get(mapping.quantity) ?? -1] ?? "";
    const revenue = mapping.revenue ? row[indexByHeader.get(mapping.revenue) ?? -1] ?? "" : "";
    const unit = mapping.unit ? row[indexByHeader.get(mapping.unit) ?? -1] ?? "" : "";
    const externalRef = mapping.externalRef ? row[indexByHeader.get(mapping.externalRef) ?? -1] ?? "" : "";

    return [saleDate, itemValue, itemValue, quantity, revenue, unit, externalRef];
  });

  const lines = [
    canonicalHeaders.map(escapeCSVCell).join(","),
    ...mappedRows.map((row) => row.map(escapeCSVCell).join(",")),
  ];
  return lines.join("\n");
}

