import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CurvePoint } from "@/lib/sniper/types";

export function EquityChart({ data }: { data: CurvePoint[] }) {
  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            formatter={(value) => [formatEquity(value), "Equity"]}
            labelFormatter={(label) => `Minute ${label}`}
            contentStyle={tipStyle}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="var(--color-brass)"
            fill="var(--color-brass)"
            fillOpacity={0.16}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HitChart({ data }: { data: { m: number; rate: number }[] }) {
  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`, "Rolling hit rate"]}
            labelFormatter={(label) => `Minute ${label}`}
            contentStyle={tipStyle}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--color-gain)"
            fill="var(--color-gain)"
            fillOpacity={0.14}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const tipStyle = {
  background: "var(--color-panel)",
  border: "1px solid var(--color-line)",
  borderRadius: "0.75rem",
  color: "var(--color-cream)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

function formatEquity(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return `$${n.toFixed(2)}`;
}
