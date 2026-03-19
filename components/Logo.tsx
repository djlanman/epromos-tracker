/* eslint-disable react/no-unknown-property */

// Pure inline SVG logo — no external files, renders everywhere reliably
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

  const w = Math.round(360 * scale);
  const h = Math.round(70 * scale);

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 360 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ePromos"
    >
      {/* ── Globe "e" mark ── */}
      <g transform="translate(2, 2)">
        {/* Main outer circle */}
        <circle cx="33" cy="33" r="30" stroke={color} strokeWidth="5" fill="none" />
        {/* Inner tilted circle (overlapping to form globe) */}
        <ellipse cx="27" cy="33" rx="19" ry="30" stroke={color} strokeWidth="4" fill="none" />
        {/* Bottom connecting arc */}
        <path d="M 10 50 Q 33 65 56 50" stroke={color} strokeWidth="4" fill="none" />
      </g>

      {/* ── "ePROMOS" text as paths ── */}
      {/* Using SVG text with system fonts - italic e + bold PROMOS */}
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
