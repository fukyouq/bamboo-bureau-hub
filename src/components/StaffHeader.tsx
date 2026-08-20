import { Leaf } from "lucide-react";

export function StaffHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="bg-header-gradient text-header-foreground shadow-elegant">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full border border-gold/40 bg-black/20">
            <Leaf className="size-5 text-gold" />
          </span>
          <h1 className="font-display text-xl tracking-wide sm:text-2xl">
            Bamboo Company <span className="mx-1 text-gold/70">|</span> Staff
          </h1>
        </div>
        {right}
      </div>
      <div className="h-px w-full bg-gold/40" />
    </header>
  );
}
