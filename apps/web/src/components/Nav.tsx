import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

const links = [
  { label: "Thesis", href: "/thesis" },
  { label: "Product", href: "/product" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <nav className="container mx-auto flex items-center justify-between gap-6 border-x px-4 py-3 sm:px-8">
        <div className="flex items-center gap-8">
          <a aria-label="Keynes home" href="/">
            <Logo />
          </a>
          <NavigationMenu className="hidden md:flex" viewport={false}>
            <NavigationMenuList className="gap-1">
              {links.map((link) => (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink href={link.href}>
                    {link.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <Button variant="link" asChild size="sm">
          <a href="/access">Get access</a>
        </Button>
      </nav>
    </header>
  );
}
