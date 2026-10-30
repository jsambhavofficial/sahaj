import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.ts",
    // Portal component tests sign in as every role; the web-only rule is tested in webPortalAccess.test.tsx
    env: {
      NEXT_PUBLIC_WEB_ROLES:
        "ops,admin,city_manager,organization_admin,coordinator,caretaker,senior,family",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

