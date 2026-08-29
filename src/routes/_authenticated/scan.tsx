import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useItems } from "@/hooks/use-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const { addItem } = useItems();
  const [form, setForm] = useState({
    name: "",
    barcode: "",
    batch: "",
    category: "",
    purchaseDate: today(),
    expiryDate: "",
    notes: "",
  });

  const onDetected = useCallback((value: string) => {
    setForm((f) => ({ ...f, barcode: value, name: f.name || `Product ${value.slice(-4)}` }));
    toast.success("Code captured: " + value);
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.expiryDate) {
      toast.error("Product name and expiry date are required");
      return;
    }
    addItem(form);
    toast.success(`${form.name} added to your dashboard`);
    navigate({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold sm:text-3xl">Scan a product</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Scan the barcode, QR code or printed expiry label — then confirm the details.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-5">
          <BarcodeScanner onDetected={onDetected} />
        </section>

        <form onSubmit={submit} className="surface-card space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" value={form.name} onChange={set("name")} placeholder="Whey Protein Chocolate" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode / QR value</Label>
              <Input id="barcode" value={form.barcode} onChange={set("barcode")} placeholder="8901234567890" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch">Batch / lot</Label>
              <Input id="batch" value={form.batch} onChange={set("batch")} placeholder="LOT-2291" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase date</Label>
              <Input id="purchaseDate" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry date</Label>
              <Input id="expiryDate" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category} onChange={set("category")} placeholder="Grocery, Dairy, Personal care" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={set("notes")} placeholder="Aisle 4, shelf B" rows={3} />
          </div>
          <Button type="submit" className="w-full">
            <Save className="mr-2 h-4 w-4" /> Save to dashboard
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
