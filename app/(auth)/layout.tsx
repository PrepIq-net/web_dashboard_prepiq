import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-44 top-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,_rgba(168,130,31,0.2)_0%,_transparent_65%)]" />
      <div className="pointer-events-none absolute -right-44 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(58,110,165,0.18)_0%,_transparent_70%)]" />
      <main className="relative z-10 min-h-screen w-full">{children}</main>
    </div>
  );
}
