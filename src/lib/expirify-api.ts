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

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 350;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorDetail(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.detail === "string") return payload.detail;
  return `Barcode lookup failed (${status})`;
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseBarcodeResult(payload: unknown): BarcodeLookupResult {
  if (!isRecord(payload) || typeof payload.found !== "boolean" || typeof payload.barcode !== "string") {
    throw new Error("The scan service returned an unexpected response. Enter the details manually.");
  }

  return {
    found: payload.found,
    barcode: payload.barcode,
    name: typeof payload.name === "string" ? payload.name.trim() || null : null,
    brand: typeof payload.brand === "string" ? payload.brand.trim() || null : null,
    category: typeof payload.category === "string" ? payload.category.trim() || null : null,
    default_shelf_life_days:
      typeof payload.default_shelf_life_days === "number" && Number.isFinite(payload.default_shelf_life_days)
        ? payload.default_shelf_life_days
        : 0,
    estimated_expiry_date: isDateString(payload.estimated_expiry_date)
      ? payload.estimated_expiry_date
      : null,
    image_url: typeof payload.image_url === "string" ? payload.image_url : null,
    source: typeof payload.source === "string" ? payload.source : "Expirify scan service",
  };
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Request was cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function lookupBarcode(
  barcode: string,
  options: { signal?: AbortSignal } = {},
): Promise<BarcodeLookupResult> {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) throw new Error("Enter a barcode first");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}/products/scan-barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ barcode: normalizedBarcode }),
        signal: timeout.signal,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // The status below still gives the user a useful fallback message.
      }

      if (!response.ok) {
        const error = new Error(errorDetail(payload, response.status));
        if (!isRetryable(response.status) || attempt === 1) throw error;
        lastError = error;
      } else {
        return parseBarcodeResult(payload);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" && options.signal?.aborted) throw error;
      lastError = error instanceof Error ? error : new Error("Could not reach the scan service");
      if (attempt === 1) {
        if (lastError.name === "AbortError") {
          throw new Error("The scan service took too long to respond. You can enter the details manually.");
        }
        throw lastError;
      }
    } finally {
      window.clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }

    await wait(RETRY_DELAY_MS, options.signal);
  }

  throw lastError ?? new Error("Could not reach the scan service");
}