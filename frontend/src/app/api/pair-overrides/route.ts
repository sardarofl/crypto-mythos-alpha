import { NextRequest, NextResponse } from "next/server";
import { getActiveOverrides, getAllOverrides, toggleOverride } from "@/lib/analyst-db";

// GET: Returns active overrides grouped by pair (for strategy consumption)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const allFlag = searchParams.get("all") === "true";

    const overrides = allFlag ? getAllOverrides() : getActiveOverrides();

    // Group by pair for strategy consumption
    const grouped: Record<string, Record<string, number>> = {};
    for (const o of overrides) {
      if (!grouped[o.pair]) grouped[o.pair] = {};
      grouped[o.pair][o.parameter_name] = o.recommended_value;
    }

    return NextResponse.json(grouped);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Toggle an override active/inactive
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, active } = body;

    if (typeof id !== "number" || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "Required: id (number), active (boolean)" },
        { status: 400 }
      );
    }

    toggleOverride(id, active);
    return NextResponse.json({ success: true, id, active });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
