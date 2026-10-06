/** Backend-only field encryption. Supply keys from server secrets/KMS, never client config. */
export type FieldContext = { tenantId: string; recordId: string; field: string };
export type EncryptedField = {
  version: 1;
  algorithm: "AES-256-GCM";
  keyId: string;
  iv: string;
  ciphertext: string;
};
export type FieldCipherOptions = {
  activeKeyId: string;
  /** Local allowlisted lookup only; never use keyId as a remote URL or file path. */
  getKey: (keyId: string) => Promise<CryptoKey>;
};
export class FieldCryptoError extends Error {
  constructor() { super("FIELD_CRYPTO_FAILED"); this.name = "FieldCryptoError"; }
}
const encoder = new TextEncoder();
const maxBytes = 65_536;
const validId = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 256;
function aad(context: FieldContext, keyId: string): Uint8Array<ArrayBuffer> {
  if (!context || ![context.tenantId, context.recordId, context.field, keyId].every(validId)) throw new FieldCryptoError();
  return encoder.encode(JSON.stringify([1, "AES-256-GCM", keyId, context.tenantId, context.recordId, context.field]));
}
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(value: unknown, min: number, max: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== "string" || value.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) throw new FieldCryptoError();
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (bytes.length < min || bytes.length > max || encode(bytes) !== value) throw new FieldCryptoError();
  return bytes;
}
function validateKey(key: CryptoKey, usage: "encrypt" | "decrypt"): void {
  if (!key || key.type !== "secret" || key.algorithm.name !== "AES-GCM"
    || !("length" in key.algorithm) || key.algorithm.length !== 256
    || key.extractable || !key.usages.includes(usage)) throw new FieldCryptoError();
}

/** Two operations only. Key rotation keeps old key IDs readable until data migration completes. */
export function createFieldCipher(options: FieldCipherOptions) {
  if (!validId(options?.activeKeyId) || typeof options?.getKey !== "function") throw new FieldCryptoError();
  const { activeKeyId, getKey } = options;
  return {
    async encrypt(plaintext: string, context: FieldContext): Promise<EncryptedField> {
      try {
        if (typeof plaintext !== "string" || plaintext.length > maxBytes) throw new FieldCryptoError();
        const data = encoder.encode(plaintext);
        if (data.length > maxBytes || new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data) !== plaintext) throw new FieldCryptoError();
        const additionalData = aad(context, activeKeyId);
        const key = await getKey(activeKeyId);
        validateKey(key, "encrypt");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, data);
        return { version: 1, algorithm: "AES-256-GCM", keyId: activeKeyId, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
      } catch { throw new FieldCryptoError(); }
    },
    async decrypt(envelope: EncryptedField, context: FieldContext): Promise<string> {
      try {
        if (!envelope || envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM" || !validId(envelope.keyId)) throw new FieldCryptoError();
        const additionalData = aad(context, envelope.keyId);
        const iv = decode(envelope.iv, 12, 12);
        const ciphertext = decode(envelope.ciphertext, 16, maxBytes + 16);
        const key = await getKey(envelope.keyId);
        validateKey(key, "decrypt");
        const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 }, key, ciphertext);
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(plaintext);
      } catch { throw new FieldCryptoError(); }
    },
  };
}
