import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { authorizationUrl, createPkcePair } from "@/lib/etsy/auth";
import { etsyCredentials } from "@/lib/etsy/config";

export async function GET() {
  try {
    const { apiKey } = etsyCredentials();
    if (!apiKey) throw new Error("Set ETSY_API_KEY in .env.local first.");
    const { verifier, challenge, state } = createPkcePair();
    const response = NextResponse.redirect(authorizationUrl(challenge, state));
    const secure = process.env.NODE_ENV === "production";
    const cookie = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure };
    response.cookies.set("etsy_oauth_state", state, cookie);
    response.cookies.set("etsy_oauth_verifier", verifier, cookie);
    return response;
  } catch (error) {
    return failure(error);
  }
}
