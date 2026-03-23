import { NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function GET() {
  try {
    const client = getClient();
    const [performance, whitelist] = await Promise.all([
      client.getPerformance(),
      client.getWhitelist(),
    ]);
    return NextResponse.json({ performance, whitelist });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
