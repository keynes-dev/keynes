import logoSvg from "@/assets/logo.svg?raw";

export function Logo() {
  return (
    <span
      aria-hidden
      className="block h-9 w-auto text-foreground [&_svg]:block [&_svg]:h-9 [&_svg]:w-auto"
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}
