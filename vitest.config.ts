import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "app/api/generate/route.ts",
        "lib/posthog-server.ts",
        "lib/posthog-client.ts",
        "lib/client-utils.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});
