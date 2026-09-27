import { NextResponse } from "next/server";
import { z } from "zod";
import { readCustomTypes } from "@/lib/custom-types";
import { scanProductIdeas } from "@/lib/discover";
import { failure } from "@/lib/http";

export const maxDuration = 180;

export async function GET() {
  try {
    return NextResponse.json({
      types: readCustomTypes().map((entry) => ({
        id: entry.id,
        label: entry.label,
        sourceTitle: entry.sourceTitle,
        sourceUrl: entry.sourceUrl,
        priceTry: entry.priceTry,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

const scanSchema = z.object({
  extra: z.string().trim().max(140).optional(),
  round: z.number().int().min(0).max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const body = scanSchema.parse(await request.json().catch(() => ({})));
    const result = await scanProductIdeas(body.extra, body.round ?? 0);
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}
