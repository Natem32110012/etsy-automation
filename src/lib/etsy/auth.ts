import { createHash, randomBytes } from "node:crypto";
import { ETSY_OAUTH_AUTHORIZE, ETSY_OAUTH_TOKEN, ETSY_SCOPES, etsyCredentials } from "./config";
import { writeTokens, type EtsyTokens } from "./store";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(16));
  return { verifier, challenge, state };
}

export function authorizationUrl(challenge: string, state: string) {
  const { apiKey, redirectUri } = etsyCredentials();
  if (!apiKey) throw new Error("ETSY_API_KEY is missing in .env.local");
  const url = new URL(ETSY_OAUTH_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", ETSY_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
};

function toTokens(raw: TokenResponse): EtsyTokens {
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    token_type: raw.token_type ?? "Bearer",
    expires_at: Date.now() + Math.max(60, raw.expires_in - 60) * 1000,
  };
}

async function tokenRequest(body: Record<string, string>): Promise<EtsyTokens> {
  const { apiKey } = etsyCredentials();
  const payload = new URLSearchParams({ client_id: apiKey, ...body });
  const response = await fetch(ETSY_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Etsy token exchange failed (${response.status}): ${text.slice(0, 400)}`);
  }
  return toTokens(JSON.parse(text) as TokenResponse);
}

export async function exchangeAuthorizationCode(code: string, verifier: string) {
  const { redirectUri } = etsyCredentials();
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });
  await writeTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  await writeTokens(tokens);
  return tokens;
}
