export default function Logo({
  size = "default",
  white = false,
}: {
  size?: "small" | "default" | "large";
  white?: boolean;
}) {
  const color = white ? "#FFFFFF" : "#1A3C28";

  const dims = {
    small: { icon: 26, text: "text-lg", gap: "gap-1.5" },
    default: { icon: 34, text: "text-2xl", gap: "gap-2" },
    large: { icon: 46, text: "text-4xl", gap: "gap-2.5" },
  }[size];

  return (
    <div className={`flex items-center ${dims.gap}`}>
      {/* ePromos globe "e" icon — faithful to the actual logo */}
      <svg
        width={dims.icon}
        height={dims.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer circle */}
        <circle cx="50" cy="50" r="44" stroke={color} strokeWidth="7" fill="none" />
        {/* Inner vertical ellipse (globe meridian) */}
        <ellipse cx="50" cy="50" rx="22" ry="44" stroke={color} strokeWidth="5" fill="none" />
        {/* Horizontal line (equator) — offset slightly to form the "e" crossbar */}
        <path d="M 8 50 Q 50 50 92 50" stroke={color} strokeWidth="5" fill="none" />
        {/* Upper latitude line */}
        <path d="M 18 30 Q 50 24 82 30" stroke={color} strokeWidth="4" fill="none" />
        {/* Lower curve that opens to form "e" */}
        <path d="M 18 70 Q 50 76 82 70" stroke={color} strokeWidth="4" fill="none" />
      </svg>
      {/* Text: ePROMOS */}
      <div className="flex items-baseline leading-none">
        <span
          className={`${dims.text} italic`}
          style={{ color, fontWeight: 900 }}
        >
          e
        </span>
        <span
          className={`${dims.text} tracking-wider`}
          style={{ color, fontWeight: 900 }}
        >
          PROMOS
        </span>
      </div>
    </div>
  );
}
