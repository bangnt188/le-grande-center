"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { neonMediaUrl } from "@/config/site";
import { DEFAULT_WEBSITE_SETTINGS, telephoneHref } from "@/shared/admin/website-defaults";
import { isWebsiteSettings, type WebsiteSettings } from "@/shared/admin/website-settings";
import { DEFAULT_FLOOR_CONTENT, isFloorConfigurations } from "@/shared/admin/space-model";
const publicFloors = DEFAULT_FLOOR_CONTENT.map(({ number, publicTitle, publicDescription }) => ({ number, publicTitle, publicDescription }));
const defaults = { settings: DEFAULT_WEBSITE_SETTINGS, logoUrl: neonMediaUrl("/client-reference/legacy/logo-without-text.png"), floorContent: publicFloors };
const WebsiteContext = createContext(defaults);
const imageTypes: Record<string, true | undefined> = { "image/png": true, "image/jpeg": true, "image/webp": true, "image/gif": true, "image/avif": true, "image/svg+xml": true };
type PublicFloorContent = (typeof publicFloors)[number];
type StoredWebsite = { settings: WebsiteSettings; assetUrl: string | null; blob: Blob | null; floorContent: PublicFloorContent[] };
const channelName = "legrande-website-settings";

function assetLogoUrl(media: Record<string, unknown>): string | null {
  if (media.projectAsset !== true || typeof media.sourcePath !== "string" || typeof media.url !== "string") return null;
  const path = media.sourcePath;
  if (!path.startsWith("/") || path.startsWith("//") || /[\\?#\u0000-\u001f]/.test(path) || path.split("/").some(part => part === "." || part === ".." || part.includes("%"))) return null;
  try {
    const url = new URL(media.url, window.location.origin);
    if (url.href !== neonMediaUrl(path)) return null;
    return url.href;
  } catch { return null; }
}

// Browser-local preview only: never creates/seeds the admin database for public visitors.
async function readWebsite(): Promise<StoredWebsite | null> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return null;
  const databases = await indexedDB.databases();
  if (!databases.some(database => database.name === "le-grande-admin-browser-v1")) return null;
  const opened = Promise.withResolvers<IDBDatabase>();
  const request = indexedDB.open("le-grande-admin-browser-v1");
  let blocked = false;
  request.onupgradeneeded = () => request.transaction?.abort();
  request.onerror = () => opened.reject(request.error);
  request.onblocked = () => { blocked = true; opened.reject(new Error("Website settings database is blocked.")); };
  request.onsuccess = () => {
    if (blocked) { request.result.close(); return; }
    request.result.onversionchange = () => request.result.close();
    opened.resolve(request.result);
  };
  const db = await opened.promise;
  try {
    if (!db.objectStoreNames.contains("state") || !db.objectStoreNames.contains("files")) return null;
    const read = Promise.withResolvers<StoredWebsite | null>();
    const transaction = db.transaction(["state", "files"], "readonly");
    let result: StoredWebsite | null = null;
    const snapshotRequest = transaction.objectStore("state").get("snapshot");
    snapshotRequest.onsuccess = () => {
      const snapshot: unknown = snapshotRequest.result;
      if (!snapshot || typeof snapshot !== "object" || !("settings" in snapshot) || !snapshot.settings || typeof snapshot.settings !== "object" || !("website" in snapshot.settings) || !isWebsiteSettings(snapshot.settings.website) || !("media" in snapshot) || !Array.isArray(snapshot.media) || !("floors" in snapshot) || !isFloorConfigurations(snapshot.floors)) return;
      const settings = snapshot.settings.website;
      const mediaItems: unknown[] = snapshot.media;
      const media = mediaItems.find((item): item is Record<string, unknown> => !!item && typeof item === "object" && "id" in item && item.id === settings.logoMediaId);
      result = { settings, assetUrl: null, blob: null, floorContent: snapshot.floors.map(({ number, publicTitle, publicDescription }) => ({ number, publicTitle, publicDescription })) };
      if (!media || media.kind !== "Ảnh" || typeof media.mimeType !== "string" || imageTypes[media.mimeType] !== true) return;
      if (media.hasUploadedFile === true) {
        const fileRequest = transaction.objectStore("files").get(settings.logoMediaId);
        fileRequest.onsuccess = () => {
          const blob = fileRequest.result;
          if (blob instanceof Blob && blob.size > 0 && blob.type !== "image/svg+xml" && imageTypes[blob.type] === true && blob.type === media.mimeType && result) result.blob = blob;
        };
      } else result.assetUrl = assetLogoUrl(media);
    };
    transaction.oncomplete = () => read.resolve(result);
    transaction.onabort = () => read.reject(transaction.error);
    return await read.promise;
  } finally { db.close(); }
}

export function WebsiteSettingsProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(defaults);
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let blobUrl: string | null = null;
    async function refresh() {
      const current = ++generation;
      let next = defaults;
      try {
        const result = await readWebsite();
        if (disposed || current !== generation) return;
        if (result) next = { settings: result.settings, logoUrl: result.blob ? URL.createObjectURL(result.blob) : result.assetUrl ?? defaults.logoUrl, floorContent: result.floorContent };
      } catch { /* Storage unavailable: static public defaults remain usable. */ }
      if (disposed || current !== generation) return;
      const previous = blobUrl;
      blobUrl = next.logoUrl.startsWith("blob:") ? next.logoUrl : null;
      setValue(next);
      if (previous) URL.revokeObjectURL(previous);
    }
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") { channel = new BroadcastChannel(channelName); channel.onmessage = () => { void refresh(); }; }
    } catch { /* Focus and same-window events still refresh the browser-local preview. */ }
    window.addEventListener("focus", refresh);
    window.addEventListener(channelName, refresh);
    document.addEventListener("visibilitychange", onVisible);
    void refresh();
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(channelName, refresh);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);
  return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>;
}

export function useWebsiteSettings() { return useContext(WebsiteContext); }
export function WebsiteAddress() { return <>{useWebsiteSettings().settings.address}</>; }
export function WebsiteMapLink({ children, className }: { children: ReactNode; className?: string }) {
  const { settings } = useWebsiteSettings();
  return <a className={className} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noopener noreferrer">{children}</a>;
}
export function WebsiteHotlineLink({ prefix = "", children, className }: { prefix?: string; children?: ReactNode; className?: string }) {
  const { settings } = useWebsiteSettings();
  return <a className={className} href={telephoneHref(settings.hotline)}>{prefix}{settings.hotline}{children}</a>;
}
export function WebsiteEmailLink({ children, className, subject, body }: { children: ReactNode; className?: string; subject?: string; body?: string }) {
  const { settings } = useWebsiteSettings();
  const query = new URLSearchParams();
  if (subject) query.set("subject", subject);
  if (body) query.set("body", body);
  return <a className={className} href={`mailto:${settings.email}${query.size ? `?${query}` : ""}`}>{children}</a>;
}
export function WebsiteLeasingPhones({ className, prefix = "" }: { className?: string; prefix?: string }) {
  const { settings } = useWebsiteSettings();
  return <>{[settings.hotline, settings.secondaryPhone].filter(Boolean).map((phone, index) => <a key={index} className={className} href={telephoneHref(phone)}>{prefix}{phone}</a>)}</>;
}
export function WebsiteFloorTitle({ floor }: { floor: number }) { return <>{useWebsiteSettings().floorContent.find(item => item.number === floor)?.publicTitle ?? `Tầng ${floor}`}</>; }
export function WebsiteFloorDescription({ floor }: { floor: number }) { return <>{useWebsiteSettings().floorContent.find(item => item.number === floor)?.publicDescription ?? ""}</>; }
