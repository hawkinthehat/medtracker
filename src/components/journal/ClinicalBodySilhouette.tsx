/**
 * Body-neutral anterior / posterior outlines in a diagnostic-chart style
 * (similar to clinical SFN / sensory mapping figures). White field, black outline only.
 */
export const CLINICAL_VIEWBOX = { w: 200, h: 520 };

type Props = {
  side: "front" | "back";
  className?: string;
};

const STROKE = "#000000";
const STROKE_W = 3.4;
const FILL = "#FFFFFF";

export default function ClinicalBodySilhouette({ side, className }: Props) {
  const flip = side === "back";

  return (
    <svg
      viewBox={`0 0 ${CLINICAL_VIEWBOX.w} ${CLINICAL_VIEWBOX.h}`}
      className={className}
      aria-hidden
    >
      <rect
        width={CLINICAL_VIEWBOX.w}
        height={CLINICAL_VIEWBOX.h}
        fill="#FFFFFF"
      />
      <g
        transform={
          flip ? `translate(${CLINICAL_VIEWBOX.w} 0) scale(-1 1)` : undefined
        }
        fill={FILL}
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Head — slightly ovoid, realistic cranial proportion */}
        <ellipse cx={100} cy={52} rx={30} ry={36} />
        {/* Neck */}
        <path d="M 78 86 Q 100 92 122 86 L 118 108 L 82 108 Z" />
        {/* Torso — shoulders, chest taper, waist, hip */}
        <path d="M 82 108 L 52 118 Q 42 128 40 145 L 38 188 Q 36 218 44 242 L 48 258 L 84 262 L 100 268 L 116 262 L 152 258 L 156 242 Q 164 218 162 188 L 160 145 Q 158 128 148 118 L 118 108 Z" />
        {/* Pelvis */}
        <path d="M 48 258 Q 46 278 52 298 L 72 308 L 100 314 L 128 308 L 148 298 Q 154 278 152 258 Z" />
        {/* Left upper arm + forearm (slight elbow flex — chart posture) */}
        <path d="M 82 112 L 44 122 Q 32 130 28 152 L 22 208 Q 20 228 28 238 L 36 242 L 42 248 L 52 252 L 56 232 L 54 168 L 62 132 Z" />
        {/* Right upper arm + forearm */}
        <path d="M 118 112 L 156 122 Q 168 130 172 152 L 178 208 Q 180 228 172 238 L 164 242 L 158 248 L 148 252 L 144 232 L 146 168 L 138 132 Z" />
        {/* Left hand */}
        <ellipse cx={34} cy={248} rx={12} ry={8} transform="rotate(-12 34 248)" />
        {/* Right hand */}
        <ellipse cx={166} cy={248} rx={12} ry={8} transform="rotate(12 166 248)" />
        {/* Left thigh + calf + foot */}
        <path d="M 72 308 L 58 388 Q 54 430 56 468 L 62 498 L 78 504 L 88 498 L 92 468 L 94 400 L 96 328 Z" />
        {/* Right thigh + calf + foot */}
        <path d="M 128 308 L 142 388 Q 146 430 144 468 L 138 498 L 122 504 L 112 498 L 108 468 L 106 400 L 104 328 Z" />
        {/* Feet */}
        <ellipse cx={70} cy={502} rx={22} ry={10} />
        <ellipse cx={130} cy={502} rx={22} ry={10} />
        {/* Midline hint — front: subtle sternum; drawn after flip so appears correct on back as spine */}
        {side === "back" && (
          <>
            <path
              fill="none"
              strokeWidth={2.4}
              d="M 100 108 L 100 258"
            />
            <path
              fill="none"
              strokeWidth={2}
              strokeOpacity={0.9}
              d="M 68 128 Q 58 150 54 175 M 132 128 Q 142 150 146 175"
            />
          </>
        )}
        {side === "front" && (
          <path
            fill="none"
            strokeWidth={2}
            strokeOpacity={0.85}
            d="M 100 118 L 100 248"
          />
        )}
      </g>
    </svg>
  );
}
