import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  buckets: { media: { access: "public_read" } },
  functions: {
    media: {
      name: "Authorized media storage origin",
      source: "./src/server/media/neon-function.ts",
      env: { MEDIA_ORIGIN_SECRET: process.env.MEDIA_ORIGIN_SECRET! },
    },
  },
});
