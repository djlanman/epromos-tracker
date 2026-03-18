export default function Logo({
  size = "default",
  white = false,
}: {
  size?: "small" | "default" | "large";
  white?: boolean;
}) {
  const color = white ? "#FFFFFF" : "#1A3C28";
  const accentColor = white ? "#4CA868" : "#2E7D47";

  const dims = {
    small: { icon: 28, text: "text-lg", gap: "gap-2" },
    default: { icon: 36, text: "text-2xl", gap: "gap-2.5" },
    large: { icon: 48, text: "text-4xl", gap: "gap-3" },
  }[size];

  return (
    <div className={`flex items-center ${dims.gap}`}>
      {/* Clock/Globe icon */}
      <svg
        width={dims.icon}
        height={dims.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer circle */}
        <circle cx="24" cy="24" r="21" stroke={color} strokeWidth="3.5" fill="none" />
        {/* Inner globe lines */}
        <ellipse cx="24" cy="24" rx="12" ry="21" stroke={color} strokeWidth="2" fill="none" />
        <line x1="3" y1="24" x2="45" y2="24" stroke={color} strokeWidth="2" />
        {/* Clock hands representing time tracking */}
        <line x1="24" y1="24" x2="24" y2="10" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
        <line x1="24" y1="24" x2="34" y2="24" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="24" cy="24" r="2" fill={accentColor} />
      </svg>
      {/* Text */}
      <div className="flex items-baseline leading-none">
        <span
          className={`${dims.text} font-black italic`}
          style={{ color: accentColor }}
        >
          e
        </span>
        <span
          className={`${dims.text} font-black tracking-wide`}
          style={{ color }}
        >
          PROMOS
        </span>
      </div>
    </div>
  );
}
