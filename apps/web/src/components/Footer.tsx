import { Logo } from "@/components/Logo";

const links = [
  { label: "Thesis", href: "/thesis" },
  { label: "Product", href: "/product" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function Footer() {
  return (
    <footer>
      <div className="container mx-auto flex flex-col items-start justify-between gap-6 border-x px-5 py-8 sm:px-8 md:flex-row md:items-center">
        <div className="flex items-center gap-6">
          <a aria-label="Keynes home" href="/">
            <Logo />
          </a>
          <span className="text-sm text-muted-foreground">
            © 2026 Keynes · Apache-2.0
          </span>
        </div>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <a
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                href={link.href}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
