import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps extends React.ComponentProps<"section"> {
  children: ReactNode;
  className?: string;
}

export function Section({ children, className, ...props }: SectionProps) {
  return (
    <section className="border-b" {...props}>
      <div className={cn("container mx-auto border-x p-8", className)}>
        {children}
      </div>
    </section>
  );
}
