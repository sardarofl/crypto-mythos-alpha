import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, getMaskedSecret, hasSecret } from "@/lib/settings-db";

// GET /api/settings - return settings (secrets are masked)
export async function GET() {
  try {
    const settings = {
      minimax_api_key: getMaskedSecret("minimax_api_key"),
      minimax_api_key_set: hasSecret("minimax_api_key"),
      sentiment_enabled: getSetting("sentiment_enabled") ?? "true",
      sentiment_refresh_minutes: getSetting("sentiment_refresh_minutes") ?? "15",
    };
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// POST /api/settings - save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Save MiniMax API key (encrypted)
    if (body.minimax_api_key && body.minimax_api_key.trim()) {
      setSetting("minimax_api_key", body.minimax_api_key.trim(), true);
    }

    // Save non-secret settings
    if (body.sentiment_enabled !== undefined) {
      setSetting("sentiment_enabled", String(body.sentiment_enabled));
    }
    if (body.sentiment_refresh_minutes !== undefined) {
      setSetting("sentiment_refresh_minutes", String(body.sentiment_refresh_minutes));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
