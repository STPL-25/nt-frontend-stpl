import { cn } from "@/lib/utils";
import spaceTextilesLogo from "@/assets/space-textiles-logo-transparent.png";

interface BrandLogoProps {
  /** Shows only the circular symbol from the left side of the supplied lockup. */
  compact?: boolean;
  className?: string;
  priority?: boolean;
}

/** Shared Space Textiles brand mark used across authentication and workspace chrome. */
export default function BrandLogo({ compact = false, className, priority = false }: BrandLogoProps) {
  if (compact) {
    return (
      <span
        className={cn(
          "relative block aspect-[9/10] h-8 shrink-0 overflow-hidden",
          className
        )}
        role="img"
        aria-label="Space Textiles (P) Ltd"
      >
        <img
          src={spaceTextilesLogo}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-[240%] max-w-none -translate-y-1/2"
          loading={priority ? "eager" : "lazy"}
        />
      </span>
    );
  }

  return (
    <span
      className={cn("relative block aspect-[7.2/1] h-8 max-w-full overflow-hidden", className)}
      role="img"
      aria-label="Space Textiles (P) Ltd"
    >
      <img
        src={spaceTextilesLogo}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-1/2 w-full max-w-none -translate-y-1/2"
        loading={priority ? "eager" : "lazy"}
      />
    </span>
  );
}
