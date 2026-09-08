import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps extends React.ComponentProps<"section"> {
  children: ReactNode;
  className?: string;
  /*
    Drawn behind the section, edge to edge, rather than inside the bordered
    container the content sits in. Anything given here is decoration: the
    content is lifted over it, so a background that wants clicks will not get
    them.
  */
  background?: ReactNode;
}

export function Section({
  children,
  className,
  background,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("border-b", background && "relative overflow-hidden")}
      {...props}
    >
      {background}
      <div
        className={cn(
          "container mx-auto border-x p-8",
          background && "relative",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
