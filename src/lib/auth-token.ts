export const SESSION_COOKIE_NAME = "lca_session";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAccessSessionToken(
  password: string,
  secret = "lca-default-session-salt"
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret || password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`authorized:${password}`)
  );
  return toHex(sig);
}

export async function verifyAccessSessionToken(
  token: string | undefined,
  password: string,
  secret = "lca-default-session-salt"
): Promise<boolean> {
  if (!token || !password) return false;
  const expected = await createAccessSessionToken(password, secret);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
