import { cn } from "@/lib/utils";

interface AsciiProps {
  className?: string;
  html: string;
}

export function Ascii({ className, html }: AsciiProps) {
  // paintAscii escapes source text before adding its controlled span markup.
  return (
    <pre
      className={cn(
        "ascii m-0 max-w-full overflow-x-auto font-mono text-xs leading-4 font-medium whitespace-pre sm:text-sm sm:leading-[18px]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
