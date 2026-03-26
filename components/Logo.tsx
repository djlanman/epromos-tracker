/* eslint-disable react/no-unknown-property */

// Pure inline SVG logo — clock/timer icon + ePROMOS text
export default function Logo({
  size = "default",
  white = false,
}: {
  size?: "small" | "default" | "large";
  white?: boolean;
}) {
  const color = white ? "#FFFFFF" : "#1B3C21";

  const scale = {
    small: 0.55,
    default: 0.7,
    large: 1,
  }[size];

  const w = Math.round(370 * scale);
  const h = Math.round(70 * scale);

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 370 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ePromos Time Study"
    >
      {/* ── Clock / Timer icon ── */}
      <g transform="translate(2, 2)">
        {/* Clock face */}
        <circle cx="33" cy="33" r="30" stroke={color} strokeWidth="5" fill="none" />
        {/* Hour markers: 12, 3, 6, 9 */}
        <line x1="33" y1="8" x2="33" y2="14" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="33" y1="52" x2="33" y2="58" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="8" y1="33" x2="14" y2="33" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="52" y1="33" x2="58" y2="33" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {/* Minute hand (pointing to 12) */}
        <line x1="33" y1="33" x2="33" y2="14" stroke={color} strokeWidth="4" strokeLinecap="round" />
        {/* Hour hand (pointing to ~2 o'clock) */}
        <line x1="33" y1="33" x2="46" y2="21" stroke={color} strokeWidth="4" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="33" cy="33" r="3" fill={color} />
        {/* Small button on top of clock */}
        <rect x="29" y="0" width="8" height="5" rx="2" fill={color} />
      </g>

      {/* ── "ePROMOS" text ── */}
      <text
        x="76"
        y="53"
        fill={color}
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontWeight="900"
        fontSize="52"
        letterSpacing="1.5"
      >
        <tspan fontStyle="italic">e</tspan>
        <tspan>PROMOS</tspan>
      </text>
    </svg>
  );
}
