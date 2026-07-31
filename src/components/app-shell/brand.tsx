import { assetUrl, cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden",
        className
      )}
    >
      <img
        src={assetUrl("/logo-mark.png")}
        alt=""
        className="size-full object-contain dark:hidden"
      />
      <img
        src={assetUrl("/logo-mark-dark.png")}
        alt=""
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}

export function BrandWordmark({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 overflow-hidden",
        className
      )}
    >
      <BrandLogo className="size-7" />
      <span className="font-heading text-lg font-semibold tracking-tight">
        Sadesk
      </span>
    </span>
  );
}
type BrandProps = {
  className?: string;
  logoClassName?: string;
  showText?: boolean;
};

export function Brand({
  className,
  logoClassName,
  showText = true,
}: BrandProps) {
  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      {showText ? (
        <BrandWordmark className={logoClassName} />
      ) : (
        <BrandLogo className={logoClassName} />
      )}
    </div>
  );
}
