import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onDetected: (value: string) => void;
};

type DetectedCode = { rawValue?: unknown };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedCode[]>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const DETECTION_FORMATS = [
  "aztec",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
];

function waitForVideo(video: HTMLVideoElement, cancelled: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      resolve();
      return;
    }

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The camera preview could not load"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    if (cancelled()) {
      cleanup();
      reject(new DOMException("Camera startup was cancelled", "AbortError"));
    }
  });
}

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const handled = useRef(false);

  useEffect(() => {
    setHasCamera(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let scanTimer: number | null = null;
    let cancelled = false;
    let zxingReader: { reset?: () => void } | null = null;
    let detectionInFlight = false;
    let lastCandidate = "";
    let candidateCount = 0;
    handled.current = false;

    const finish = (value: string) => {
      const normalized = value.trim();
      if (handled.current || cancelled || !normalized) return;
      handled.current = true;
      onDetected(normalized);
      setActive(false);
    };

    const registerCandidate = (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      if (normalized === lastCandidate) {
        candidateCount += 1;
      } else {
        lastCandidate = normalized;
        candidateCount = 1;
      }

      // Require two matching frames to avoid saving a partial/false read.
      if (candidateCount >= 2) finish(normalized);
    };

    const run = async () => {
      setError(null);
      setStarting(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Camera access is unavailable", "NotFoundError");
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
            audio: false,
          });
        } catch (firstError) {
          // Some mobile browsers reject ideal resolution constraints even when a
          // camera is available, so retry with the simplest valid request.
          if (firstError instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(firstError.name)) {
            throw firstError;
          }
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.muted = true;
          await waitForVideo(video, () => cancelled);
          await video.play();
        }
        setStarting(false);

        const Detector = (window as unknown as {
          BarcodeDetector?: BarcodeDetectorConstructor;
        }).BarcodeDetector;

        if (Detector) {
          let detector: BarcodeDetectorLike;
          try {
            detector = new Detector({ formats: DETECTION_FORMATS });
          } catch {
            detector = new Detector();
          }

          const tick = async () => {
            if (cancelled || handled.current || !videoRef.current || detectionInFlight) return;
            detectionInFlight = true;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes?.[0]?.rawValue;
              if (typeof value === "string") registerCandidate(value);
            } catch {
              /* keep scanning */
            } finally {
              detectionInFlight = false;
            }
            if (!cancelled && !handled.current) scanTimer = window.setTimeout(() => void tick(), 120);
          };
          void tick();
          return;
        }

        // Fallback: pure-JS reader for browsers without native barcode support
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 200 });
        zxingReader = reader as unknown as { reset?: () => void };
        if (!videoRef.current) return;
        await reader.decodeFromStream(stream, videoRef.current, (result) => {
          const text = result?.getText?.();
          if (text) registerCandidate(text);
        });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        const message =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access was blocked. Allow camera access in your browser, then try again — or enter the code manually below."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found. Enter the code manually below."
              : name === "NotReadableError"
                ? "The camera is being used by another app. Close it or enter the code manually."
                : "The camera could not start. Enter the code manually below.";
        setError(message);
        setActive(false);
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      try {
        zxingReader?.reset?.();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setStarting(false);
    };
  }, [active, onDetected]);

  return (
    <div className="space-y-3">
      <div className="scan-frame relative aspect-[4/3] overflow-hidden bg-secondary/60">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <span className="animate-radar absolute inset-0 opacity-60" aria-hidden />
            <span className="animate-pulse-ring grid h-14 w-14 place-items-center rounded-full bg-primary/15">
              <ScanLine className="h-7 w-7 text-primary" />
            </span>
            <p className="relative max-w-xs text-sm text-muted-foreground">
              Point the camera at a barcode, QR code or printed expiry label.
            </p>
          </div>
        )}

        {active && starting && (
          <div className="absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-sm text-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Starting camera…
            </div>
          </div>
        )}

        {active && (
          <>
            <span className="scan-line top-6" aria-hidden />
            <div className="pointer-events-none absolute inset-6" aria-hidden>
              {[
                "left-0 top-0 border-l-2 border-t-2 rounded-tl-lg",
                "right-0 top-0 border-r-2 border-t-2 rounded-tr-lg",
                "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-lg",
                "right-0 bottom-0 border-r-2 border-b-2 rounded-br-lg",
              ].map((pos, i) => (
                <span
                  key={pos}
                  className={`animate-bracket absolute h-8 w-8 border-primary ${pos}`}
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={active ? "secondary" : "default"}
          onClick={() => setActive((v) => !v)}
          disabled={starting}
        >
          {active ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
          {starting ? "Opening camera…" : active ? "Stop scanning" : "Start scanning"}
        </Button>
        {!hasCamera && (
          <span className="text-xs text-muted-foreground">
            This browser has no camera access — use manual entry below.
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
