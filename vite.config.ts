import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => ({
  plugins: [
    {
      name: "dealsrky-production-no-dep-optimizer",
      enforce: "post",
      configResolved(config) {
        if (command !== "build" && mode !== "production") return;
        // React Router may create a temporary Vite server during a build.
        // Apply the opt-out after framework plugins have merged their includes.
        for (const environment of Object.values(config.environments)) {
          environment.optimizeDeps.noDiscovery = true;
          environment.optimizeDeps.include = [];
        }
        config.optimizeDeps.noDiscovery = true;
        config.optimizeDeps.include = [];
      },
    } satisfies Plugin,
    cloudflare({
      remoteBindings: false,
      viteEnvironment: { name: "ssr" },
    }),
    ...(process.env.VITEST ? [] : [reactRouter()]),
    tsconfigPaths(),
    tailwindcss(),
  ],
}));
