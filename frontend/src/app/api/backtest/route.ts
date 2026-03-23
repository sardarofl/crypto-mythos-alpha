import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function POST(request: NextRequest) {
  try {
    const client = getClient();
    const body = await request.json();
    const result = await client.startBacktest(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  try {
    const client = getClient();
    const result = await client.getBacktestStatus();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const client = getClient();
    const result = await client.deleteBacktest();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
