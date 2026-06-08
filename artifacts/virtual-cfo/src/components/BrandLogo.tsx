import { Link } from "wouter";
import { cn } from "@/lib/utils";

export const BRAND_ASSETS = {
  logo: "nightscout-logo.png",
  mascot: "nightscout-mascot.png",
} as const;

type BrandLogoVariant = keyof typeof BRAND_ASSETS;

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
  glow?: boolean;
}

export function BrandLogo({
  variant = "logo",
  className,
  imageClassName,
  glow = false,
}: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center",
        glow && "rounded-full shadow-[0_0_45px_rgba(0,76,255,0.35)]",
        className
      )}
    >
      <img
        src={`${import.meta.env.BASE_URL}${BRAND_ASSETS[variant]}`}
        alt="Night Scout logo"
        className={cn("w-auto object-contain", imageClassName)}
      />
    </Link>
  );
}
