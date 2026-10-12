import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRepository } from "../src/features/admin/demo/repository";
import { projectMedia, synchronizeProjectMedia } from "../src/features/admin/demo/project-media";

// Browser proof covers persistence/notifications; these guards protect data integrity.
test("project catalog reconciliation preserves uploaded media and protects shipped assets", async t => {
  const repo = createDemoRepository(); t.after(() => repo.dispose());
  const uploaded = await repo.upload([new File(["%PDF-1.7\n%%EOF"], "upload.pdf", { type: "application/pdf" })], "Tầng 3");
  const file = uploaded.media.find(item => item.hasUploadedFile)!;
  const stale = structuredClone(uploaded);
  stale.media = [file, { ...file, id: "sample-plan", hasUploadedFile: false }];
  assert.equal(synchronizeProjectMedia(stale), true);
  assert.deepEqual(stale.media.find(item => item.id === file.id), file);
  assert.equal(stale.media.some(item => item.id === "sample-plan"), false);
  assert.equal(synchronizeProjectMedia(stale), false);
  const hero = projectMedia().find(item => item.sourcePath === "/images/home-v2/hero.webp")!;
  for (const command of [{ type: "delete-media", mediaId: hero.id }, { type: "rename-media", mediaId: hero.id, name: "Changed" }, { type: "link-media", mediaId: hero.id, scope: "Tầng 1" }] as const) await assert.rejects(repo.execute(command), /Asset website/);
  assert.deepEqual(await repo.read(), uploaded);
});

test("website configuration validates contacts and logo references, protecting the active upload", async t => {
  const repo = createDemoRepository(); t.after(() => repo.dispose()); const initial = await repo.read();
  const original = initial.settings.website;
  for (const values of [{ ...original, email: "bad" }, { ...original, hotline: "letters" }, { ...original, zaloUrl: "javascript:alert(1)" }, { ...original, zaloUrl: "https://example.com/profile" }, { ...original, logoMediaId: "missing" }, { ...original, logoMediaId: "sample-brochure" }]) await assert.rejects(repo.execute({ type: "update-website-settings", values }));
  assert.deepEqual(await repo.read(), initial);
  const png = new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64")], "logo.png", { type: "image/png" });
  const uploaded = await repo.upload([png], "Toàn dự án"), logo = uploaded.media.find(item => item.hasUploadedFile)!;
  const saved = await repo.execute({ type: "update-website-settings", values: { ...original, email: "leasing@example.test", hotline: "0901234567", address: "Địa chỉ thử nghiệm", logoMediaId: logo.id, zaloUrl: "https://zalo.me/0901234567" } });
  assert.equal(saved.settings.website.logoMediaId, logo.id); assert.equal(saved.settings.website.email, "leasing@example.test");
  assert.deepEqual(saved.settings.defaultHoldHours, initial.settings.defaultHoldHours);
  await assert.rejects(repo.execute({ type: "delete-media", mediaId: logo.id }), /logo website/);
  assert.deepEqual(await repo.read(), saved);
  await repo.execute({ type: "update-website-settings", values: original });
  const removed = await repo.execute({ type: "delete-media", mediaId: logo.id });
  assert.equal(removed.storage?.usedBytes, 0);
});
