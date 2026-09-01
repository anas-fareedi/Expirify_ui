import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Save, ScanLine } from "lucide-react";
import { timelineLabel } from "@/lib/expiry";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useItems } from "@/hooks/use-items";
import { useActiveList } from "@/hooks/use-lists";
import { ListSwitcher } from "@/components/ListSwitcher";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MotionCard, Reveal } from "@/components/motion";


export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan Product Label — Expirify Barcode & Expiry Capture" },
      {
        name: "description",
        content:
          "Scan a barcode, QR code or printed label to capture product name, purchase date and expiry date on any phone or laptop camera.",
      },
      { property: "og:title", content: "Scan Product Label — Expirify" },
      {
        property: "og:description",
        content: "Capture expiry details from labels with your device camera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function ScanPage() {
  const navigate = useNavigate();
  const { lists, activeList, select } = useActiveList();
  const { addItem } = useItems(activeList?.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    barcode: "",
    category: "",
    purchaseDate: today(),
    expiryDate: "",
  });

  const onDetected = useCallback((value: string) => {
    setForm((f) => ({ ...f, barcode: value, name: f.name || `Product ${value.slice(-4)}` }));
    toast.success("Code captured: " + value);
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.expiryDate) {
      toast.error("Product name and expiry date are required");
      return;
    }
    if (!activeList) {
      toast.error("Create or join a list first");
      navigate({ to: "/lists" });
      return;
    }
    setSaving(true);
    try {
      await addItem(form);
      toast.success(`${form.name} added to ${activeList.name}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the item");
    } finally {
      setSaving(false);
    }
  };


  const preview = form.expiryDate ? timelineLabel(form.expiryDate) : null;

  return (
    <AppShell>
      <div className="animate-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
            <ScanLine className="h-3.5 w-3.5 animate-pulse" /> Step 1 · Scan &nbsp;·&nbsp; Step 2 · Confirm
          </span>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Scan a product</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Point your camera at the barcode, QR code or printed expiry label.
          </p>
        </div>
        {preview && (
          <span key={preview} className="animate-count rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm">
            <CalendarClock className="mr-2 inline h-4 w-4 text-primary" />
            {preview}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <MotionCard strength={0.5} className="surface-card glow-ring flow-border p-5">
            <BarcodeScanner onDetected={onDetected} />
          </MotionCard>
        </Reveal>

        <Reveal delay={120}>
        <form onSubmit={submit} className="surface-card spotlight space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Product name <span className="text-primary">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={set("name")}
              placeholder="Whey Protein Chocolate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode / QR value</Label>
            <Input
              id="barcode"
              value={form.barcode}
              onChange={set("barcode")}
              placeholder="8901234567890"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase date</Label>
              <Input id="purchaseDate" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">
                Expiry date <span className="text-primary">*</span>
              </Label>
              <Input id="expiryDate" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={set("category")}
              placeholder="Grocery, Dairy, Personal care"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {["Grocery", "Dairy", "Bakery", "Personal care", "Medicine"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" size="lg" className="hover-scale w-full">
            <Save className="mr-2 h-4 w-4" /> Save to dashboard
          </Button>
        </form>
        </Reveal>
      </div>
    </AppShell>
  );
}
