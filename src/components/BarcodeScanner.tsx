import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onDetected: (value: string) => void;
};

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const Detector = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
        if (!Detector) return;
        const detector = new Detector();
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              onDetected(String(codes[0].rawValue));
              setActive(false);
              return;
            }
          } catch {
            /* keep scanning */
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setError("Camera access was blocked. Enter the label details manually below.");
        setActive(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onDetected]);

  return (
    <div className="space-y-3">
      <div className="scan-frame relative aspect-[4/3] overflow-hidden bg-secondary/60">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <ScanLine className="h-10 w-10 text-primary" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Point the camera at a barcode, QR code or printed expiry label.
            </p>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-primary/70 animate-pulse" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={active ? "secondary" : "default"} onClick={() => setActive((v) => !v)}>
          {active ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
          {active ? "Stop scanning" : "Start scanning"}
        </Button>
        {!supported && (
          <span className="text-xs text-muted-foreground">
            Live code reading isn&apos;t supported on this browser — use manual entry.
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
