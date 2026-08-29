// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
});
