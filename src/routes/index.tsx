import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, LineChart, ScanLine, ShieldCheck, Smartphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/expirify-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Expirify — Scan Labels, Track Product Expiry Dates" },
      {
        name: "description",
        content:
          "Expirify lets shoppers, grocery outlets and malls scan barcodes, QR codes or printed labels to store expiry dates and get 7, 3 and 1 day alerts.",
      },
      { property: "og:title", content: "Expirify — Scan Labels, Track Product Expiry" },
      {
        property: "og:description",
        content:
          "Scan any product label on phone or laptop and get timeline alerts before items expire.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ScanLine,
    title: "Instant label scan",
    body: "Read barcodes, QR codes or printed expiry text with any device camera.",
  },
  {
    icon: Bell,
    title: "Timeline alerts",
    body: "Automatic 7-day, 3-day and 1-day warnings before an item goes bad.",
  },
  {
    icon: LineChart,
    title: "Shelf-life dashboard",
    body: "Every product with purchase date, expiry date and remaining shelf life.",
  },
  {
    icon: Store,
    title: "Built for outlets",
    body: "Works for a home kitchen shelf or a full grocery aisle rotation check.",
  },
];

const ticker = [
  "7 days left · Greek yoghurt",
  "3 days left · Sourdough loaf",
  "1 day left · Fresh basil",
  "Expired · Almond milk",
  "Fresh · Canned tomatoes",
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* animated ambient graphics */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span
          className="aurora-blob animate-drift left-[-12%] top-[-10%] h-[42rem] w-[42rem]"
          style={{ background: "var(--gradient-glow)" }}
        />
        <span
          className="aurora-blob animate-float right-[-16%] top-[22%] h-[32rem] w-[32rem]"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.1 200 / 0.7), transparent 70%)" }}
        />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="animate-rise flex items-center gap-2">
          <span className="glow-ring animate-pulse-ring grid h-9 w-9 place-items-center rounded-lg bg-primary/15">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </span>
          <span className="font-display text-lg font-semibold">Expirify</span>
        </div>
        <div className="animate-rise flex items-center gap-2" style={{ animationDelay: "80ms" }}>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hover-scale">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Smartphone className="h-3.5 w-3.5" /> Phone · Laptop · Tablet
            </span>
            <h1
              className="animate-rise mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "120ms" }}
            >
              Scan it. <span className="shimmer-text">Track it.</span> Never waste it.
            </h1>
            <p
              className="animate-rise mt-5 max-w-xl text-base text-muted-foreground"
              style={{ animationDelay: "220ms" }}
            >
              Expirify captures product name, purchase date and expiry date straight from the label —
              then warns you at 7 days, 3 days and 1 day left, so nothing expires on your shelf.
            </p>
            <div
              className="animate-rise mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: "320ms" }}
            >
              <Button asChild size="lg" className="hover-scale">
                <Link to="/auth">Create free account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="hover-scale">
                <Link to="/auth">Sign in with mobile</Link>
              </Button>
            </div>

            {/* live alert ticker */}
            <div
              className="animate-rise surface-card mt-10 overflow-hidden py-3"
              style={{ animationDelay: "420ms" }}
            >
              <div className="animate-ticker flex w-max gap-8 whitespace-nowrap px-4 text-xs text-muted-foreground">
                {[...ticker, ...ticker].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className="scan-frame animate-rise animate-float relative overflow-hidden"
            style={{ animationDelay: "200ms" }}
          >
            <img
              src={heroImage}
              alt="Hand scanning a grocery product barcode with a phone to capture its expiry date"
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
            <span aria-hidden className="scan-line top-0" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="animate-rise text-2xl font-semibold sm:text-3xl">Everything on one shelf</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <article
                key={f.title}
                className="surface-card lift-card animate-rise p-5"
                style={{ animationDelay: `${100 + i * 90}ms` }}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15">
                  <f.icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <p className="text-center text-xs text-muted-foreground">
          Expirify — expiry tracking for shoppers, grocery outlets and malls.
        </p>
      </footer>
    </div>
  );
}
