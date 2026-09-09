import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps extends React.ComponentProps<"section"> {
  children: ReactNode;
  className?: string;
}

export function Section({ children, className, ...props }: SectionProps) {
  return (
    <section className="border-b border-primary" {...props}>
      <div
        className={cn(
          "container mx-auto border-x border-primary p-8",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
