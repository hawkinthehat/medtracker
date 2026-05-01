"use client";

import { standing3mReading } from "@/lib/orthostatic-utils";
import type { OrthostaticSession } from "@/lib/types";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PositionalRow = {
  position: string;
  deltaSystolic: number;
  deltaDiastolic: number;
};

export function orthostaticSessionToDeltaRows(
  o: OrthostaticSession
): PositionalRow[] {
  const lSys = o.lying.systolic;
  const lDia = o.lying.diastolic;
  const st3 = standing3mReading(o);
  if (!st3) {
    return [];
  }

  const rows: PositionalRow[] = [
    {
      position: "Lying",
      deltaSystolic: 0,
      deltaDiastolic: 0,
    },
    {
      position: "Sitting",
      deltaSystolic: lSys - o.sitting.systolic,
      deltaDiastolic: lDia - o.sitting.diastolic,
    },
  ];

  if (o.standing1m) {
    rows.push({
      position: "Standing (1m)",
      deltaSystolic: lSys - o.standing1m.systolic,
      deltaDiastolic: lDia - o.standing1m.diastolic,
    });
  }

  rows.push({
    position: "Standing (3m)",
    deltaSystolic: lSys - st3.systolic,
    deltaDiastolic: lDia - st3.diastolic,
  });

  return rows;
}

type Props = {
  session: OrthostaticSession;
};

export default function PositionalDeltaChart({ session }: Props) {
  const data = orthostaticSessionToDeltaRows(session);
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Incomplete session — standing readings missing.
      </p>
    );
  }

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="position"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={56}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            label={{
              value: "Δ mmHg vs lying",
              angle: -90,
              position: "insideLeft",
              fill: "#94a3b8",
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <ReferenceLine
            y={20}
            stroke="#f87171"
            strokeDasharray="4 4"
            label={{
              value: "Danger (≥20 mmHg systolic drop)",
              fill: "#fca5a5",
              fontSize: 11,
              position: "insideTopRight",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="deltaSystolic"
            name="Δ Systolic"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="deltaDiastolic"
            name="Δ Diastolic"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
