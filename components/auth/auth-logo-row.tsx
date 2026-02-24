import Image from "next/image";

type AuthLogoRowProps = {
  size?: number;
};

export function AuthLogoRow({ size = 50 }: AuthLogoRowProps) {
  return (
    <div className="mb-10 flex items-center gap-3">
      <Image
        src="/logo/golden-main-transparent.png"
        alt="PrepIQ logo"
        width={size}
        height={size}
        className="h-auto w-auto"
        priority
      />
      <span className="font-display text-2xl font-semibold tracking-tight text-text-primary">
        PrepIQ
      </span>
    </div>
  );
}
