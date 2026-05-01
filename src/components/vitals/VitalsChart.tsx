"use client";

import { standing3mReading } from "@/lib/orthostatic-utils";
import type { OrthostaticSession } from "@/lib/types";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Ordered categories for positional BP comparison (matches guided orthostatic flow). */
export const POSITIONAL_COMPARISON_LABELS = [
  "Lying",
  "Sitting",
  "Standing (1m)",
  "Standing (3m)",
] as const;

export type PositionalComparisonRow = {
  position: (typeof POSITIONAL_COMPARISON_LABELS)[number];
  systolic: number | null;
  diastolic: number | null;
};

export function orthostaticSessionToPositionalBP(
  o: OrthostaticSession
): PositionalComparisonRow[] | null {
  const st3 = standing3mReading(o);
  if (!st3) {
    return null;
  }

  return [
    {
      position: "Lying",
      systolic: o.lying.systolic,
      diastolic: o.lying.diastolic,
    },
    {
      position: "Sitting",
      systolic: o.sitting.systolic,
      diastolic: o.sitting.diastolic,
    },
    {
      position: "Standing (1m)",
      systolic: o.standing1m?.systolic ?? null,
      diastolic: o.standing1m?.diastolic ?? null,
    },
    {
      position: "Standing (3m)",
      systolic: st3.systolic,
      diastolic: st3.diastolic,
    },
  ];
}

/**
 * Orthostatic-style alert: drop from lying to 3 min standing — same thresholds as
 * {@link OrthostaticTracker} (≥20 mmHg systolic or ≥10 mmHg diastolic).
 */
export function isPositionalOrthostaticAlert(o: OrthostaticSession): boolean {
  const st3 = standing3mReading(o);
  if (!st3) return false;
  const sysDrop = o.lying.systolic - st3.systolic;
  const diaDrop = o.lying.diastolic - st3.diastolic;
  return sysDrop >= 20 || diaDrop >= 10;
}

const WARNING_FILL = "rgba(248, 113, 113, 0.14)";
const WARNING_STROKE = "rgba(248, 113, 113, 0.35)";

type Props = {
  session: OrthostaticSession;
};

export default function VitalsChart({ session }: Props) {
  const data = orthostaticSessionToPositionalBP(session);
  const showOrthostaticBand = isPositionalOrthostaticAlert(session);

  if (!data) {
    return (
      <p className="text-sm text-slate-500">
        Incomplete session — standing (3m) reading missing.
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
          {showOrthostaticBand && (
            <ReferenceArea
              x1="Lying"
              x2="Standing (3m)"
              yAxisId="left"
              fill={WARNING_FILL}
              stroke={WARNING_STROKE}
              strokeWidth={1}
              ifOverflow="visible"
            />
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="position"
            type="category"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={56}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            domain={["auto", "auto"]}
            label={{
              value: "mmHg",
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
            formatter={(value, name) => {
              if (value === null || value === undefined || value === "") {
                return ["—", name];
              }
              return [`${value} mmHg`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="systolic"
            name="Systolic"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="diastolic"
            name="Diastolic"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      {showOrthostaticBand && (
        <p className="mt-2 text-xs text-red-300/90">
          Lying → standing (3m) change meets or exceeds common orthostatic
          thresholds (≥20 mmHg systolic or ≥10 mmHg diastolic drop).
        </p>
      )}
    </div>
  );
}
