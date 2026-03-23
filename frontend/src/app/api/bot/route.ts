import { NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function GET() {
  try {
    const client = getClient();
    const [config, balance, profit, openTrades, daily] = await Promise.allSettled([
      client.getConfig(),
      client.getBalance(),
      client.getProfit(),
      client.getOpenTrades(),
      client.getDaily(30),
    ]);

    return NextResponse.json({
      config: config.status === "fulfilled" ? config.value : null,
      balance: balance.status === "fulfilled" ? balance.value : null,
      profit: profit.status === "fulfilled" ? profit.value : null,
      openTrades: openTrades.status === "fulfilled" ? openTrades.value : [],
      daily: daily.status === "fulfilled" ? daily.value.data : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const client = getClient();
    const body = await request.json();
    const { action } = body;

    let result;
    switch (action) {
      case "start":
        result = await client.startBot();
        break;
      case "stop":
        result = await client.stopBot();
        break;
      case "pause":
        result = await client.pauseBot();
        break;
      case "force_entry":
        result = await client.forceEntry(body.pair, body.side, body.price, body.stakeAmount);
        break;
      case "force_exit":
        result = await client.forceExit(body.tradeid, body.ordertype);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
