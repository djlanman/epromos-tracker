import Image from "next/image";

export default function Logo({
  size = "default",
  white = false,
}: {
  size?: "small" | "default" | "large";
  white?: boolean;
}) {
  const dims = {
    small: { width: 140, height: 27 },
    default: { width: 180, height: 35 },
    large: { width: 240, height: 46 },
  }[size];

  return (
    <Image
      src={white ? "/epromos-logo-white.png" : "/epromos-logo.png"}
      alt="ePromos"
      width={dims.width}
      height={dims.height}
      priority
    />
  );
}
