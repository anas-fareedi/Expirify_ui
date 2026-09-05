export type BarcodeLookupResult = {
  found: boolean;
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  default_shelf_life_days: number;
  estimated_expiry_date: string | null;
  image_url: string | null;
  source: string;
};

const API_URL = (import.meta.env["VITE_EXPIRIFY_API_URL"] || "https://expirify.onrender.com").replace(
  /\/$/,
  "",
);

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const response = await fetch(`${API_URL}/products/scan-barcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: barcode.trim() }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the API error below useful even if the service returns non-JSON.
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : `Barcode lookup failed (${response.status})`;
    throw new Error(detail);
  }

  return payload as BarcodeLookupResult;
}