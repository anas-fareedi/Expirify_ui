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

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const handled = useRef(false);

  useEffect(() => {
    setHasCamera(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    let zxingReader: { reset?: () => void } | null = null;
    handled.current = false;

    const finish = (value: string) => {
      if (handled.current || cancelled) return;
      handled.current = true;
      onDetected(value.trim());
      setActive(false);
    };

    const run = async () => {
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => undefined);
        }

        const Detector = (window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
        }).BarcodeDetector;

        if (Detector) {
          const detector = new Detector();
          const tick = async () => {
            if (cancelled || handled.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const value = codes?.[0]?.rawValue;
              if (typeof value === "string" && value.trim()) {
                finish(value);
                return;
              }
            } catch {
              /* keep scanning */
            }
            raf = requestAnimationFrame(() => void tick());
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
          if (text) finish(text);
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
      }
    };

    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try {
        zxingReader?.reset?.();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
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
        >
          {active ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
          {active ? "Stop scanning" : "Start scanning"}
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
