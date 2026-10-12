import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      media: { access: "public_read" },
    },
    functions: {
      api: { name: "api", source: "./hello.ts" },
    },
  },
});
