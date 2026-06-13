import Image from "next/image";

import { BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/brand";

export function BrandLogo(props: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const size = props.size ?? "md";
  const maxW =
    size === "sm" ? "max-w-[96px]" : size === "lg" ? "max-w-[180px]" : "max-w-[132px]";

  return (
    <Image
      src={BRAND_LOGO_PATH}
      alt={BRAND_NAME}
      width={320}
      height={120}
      priority
      className={`h-auto w-full object-contain ${maxW} ${props.className ?? ""}`}
    />
  );
}
