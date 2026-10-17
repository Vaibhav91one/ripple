// AES-256-GCM secret encryption. Format: v1:<kid>:<nonce>:<ct>:<tag> (kid hex, the rest base64url).
// Keys: RIPPLE_SECRET_KEY (32-byte base64) encrypts; when unset, HKDF-SHA256(ACK_TOKEN_SECRET) derives it; RIPPLE_SECRET_KEY_OLD may still decrypt (rotation). kid = sha256(key)[0..8] hex.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "./env";

const kidOf = (key: Buffer) => createHash("sha256").update(key).digest("hex").slice(0, 8);

function parseKey(name: string, b64: string | undefined): Buffer | null {
  if (!b64) return null;
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64 encoded (generate: openssl rand -base64 32)`);
  return key;
}

// Fallback so a deploy needs no extra secret: ikm = ACK_TOKEN_SECRET, empty salt, fixed info. Set RIPPLE_SECRET_KEY to rotate.
function derived(ikm: string | undefined): Buffer | null {
  return ikm ? Buffer.from(hkdfSync("sha256", ikm, "", "ripple/connector-secrets/v1", 32)) : null;
}

function keys() {
  const e = env();
  const cur = parseKey("RIPPLE_SECRET_KEY", e.RIPPLE_SECRET_KEY) ?? derived(e.ACK_TOKEN_SECRET);
  if (!cur) throw new Error("RIPPLE_SECRET_KEY is not set; connector secrets cannot be encrypted (generate: openssl rand -base64 32)");
  const old = parseKey("RIPPLE_SECRET_KEY_OLD", e.RIPPLE_SECRET_KEY_OLD);
  return { cur, byKid: new Map([...(old ? [old] : []), cur].map((k) => [kidOf(k), k])) };
}

export function encrypt(plaintext: string): string {
  const { cur } = keys();
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cur, nonce, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return ["v1", kidOf(cur), nonce.toString("base64url"), ct.toString("base64url"), c.getAuthTag().toString("base64url")].join(":");
}

export function decrypt(s: string): string {
  const [v, kid, nonce, ct, tag, ...extra] = s.split(":");
  if (v !== "v1" || !tag || extra.length) throw new Error("unsupported ciphertext format");
  const key = keys().byKid.get(kid);
  if (!key) throw new Error(`no secret key for kid ${kid}; set RIPPLE_SECRET_KEY_OLD to the key that encrypted this value`);
  const t = Buffer.from(tag, "base64url");
  if (t.length !== 16) throw new Error("invalid auth tag"); // never accept truncated GCM tags
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"), { authTagLength: 16 });
  d.setAuthTag(t);
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8"); // final() throws on tamper
}
