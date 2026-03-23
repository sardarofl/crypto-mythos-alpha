"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";
import type { DailyRecord } from "@/types/freqtrade";

interface Props {
  data: DailyRecord[];
}

export function PnLChart({ data }: Props) {
  // Calculate cumulative P&L
  const chartData = [...data].reverse().reduce<
    { date: string; profit: number; cumulative: number }[]
  >((acc, record) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({
      date: record.date,
      profit: record.abs_profit,
      cumulative: prev + record.abs_profit,
    });
    return acc;
  }, []);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Cumulative P&L (30 Days)</h3>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E3A4E" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8A99AF", fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "#8A99AF", fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1E293B",
                border: "1px solid #2E3A4E",
                borderRadius: "8px",
                color: "#DEE4EE",
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "P&L"]}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#profitGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
