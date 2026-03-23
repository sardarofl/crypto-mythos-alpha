import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function GET(request: NextRequest) {
  try {
    const client = getClient();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await client.getTrades(limit, offset);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
