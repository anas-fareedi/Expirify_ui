// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// On Vercel (or when NITRO_PRESET=vercel is set) build with Nitro's vercel preset
// so the output lands in .vercel/output. Locally/on Lovable the default target is used.
const vercelBuild =
  process.env["VERCEL"] === "1" || process.env["NITRO_PRESET"] === "vercel";

export default defineConfig({
  ...(vercelBuild ? { nitro: { preset: "vercel" as const } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "Expirify — Expiry Tracker",
          short_name: "Expirify",
          description:
            "Scan product labels, share lists with family and get alerts before anything expires.",
          start_url: "/dashboard",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#0d1512",
          theme_color: "#0d1512",
          icons: [
            { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/app-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "expirify-pages" },
            },
            {
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "font" ||
                  request.destination === "image"),
              handler: "CacheFirst",
              options: {
                cacheName: "expirify-assets",
                expiration: { maxEntries: 120 },
              },
            },
          ],
        },
      }),
    ],
  },
});

