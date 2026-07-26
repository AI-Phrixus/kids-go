const te = new TextEncoder();

export function uid(): string {
  return crypto.randomUUID();
}

/** Hex SHA-256 — used to store session tokens hashed at rest. */
export async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(input));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function hashPassword(password: string, saltB64?: string): Promise<string> {
  const salt = saltB64
    ? b64ToBytes(saltB64)
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const next = await hashPassword(password, parts[1]);
  return next === stored;
}

export async function hashPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  return verifyPassword(pin, stored);
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
