import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestThemes } from "@/lib/concepts";
import { failure } from "@/lib/http";
import { productTypeSchema } from "@/lib/types";

const bodySchema = z.object({
  type: productTypeSchema,
  exclude: z.array(z.string()).optional(),
  idea: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    return NextResponse.json({
      themes: await suggestThemes(body.type, body.exclude ?? [], body.idea),
    });
  } catch (error) {
    return failure(error);
  }
}
