import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeAuthorizationCode } from "@/lib/etsy/auth";
import { refreshShopSections, syncShopProfile } from "@/lib/etsy/shop";
import { refreshTaxonomy } from "@/lib/etsy/taxonomy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const origin = url.origin;
  if (error) {
    return NextResponse.redirect(`${origin}/etsy?error=${encodeURIComponent(error)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("etsy_oauth_state")?.value;
  const verifier = jar.get("etsy_oauth_verifier")?.value;
  jar.delete("etsy_oauth_state");
  jar.delete("etsy_oauth_verifier");

  if (!code || !state || !verifier || state !== expected) {
    return NextResponse.redirect(`${origin}/etsy?error=${encodeURIComponent("OAuth state mismatch")}`);
  }

  try {
    await exchangeAuthorizationCode(code, verifier);
    await syncShopProfile();
    await refreshTaxonomy().catch(() => undefined);
    await refreshShopSections().catch(() => undefined);
    return NextResponse.redirect(`${origin}/etsy?connected=1`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.redirect(`${origin}/etsy?error=${encodeURIComponent(message)}`);
  }
}
