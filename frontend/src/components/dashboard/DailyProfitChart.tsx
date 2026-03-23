"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/Card";
import type { DailyRecord } from "@/types/freqtrade";

interface Props {
  data: DailyRecord[];
}

export function DailyProfitChart({ data }: Props) {
  const chartData = [...data]
    .slice(0, 14)
    .reverse()
    .map((r) => ({
      date: r.date,
      profit: r.abs_profit,
      trades: r.trade_count,
    }));

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-base font-semibold">Daily Profit (14 Days)</h3>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
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
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Profit"]}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.profit >= 0 ? "#10B981" : "#F43F5E"}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
