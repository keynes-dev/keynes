import { ArrowRight } from "lucide-react";

import { ConveyorBelt } from "./ConveyorBelt";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    // The drawing is clipped to the container rather than run across the whole
    // section, so its grid stops at the same rules everything else on the page
    // lines up with.
    <Section className="relative flex min-h-[40rem] flex-col justify-start overflow-hidden pt-12 pb-24 lg:min-h-[32rem] lg:justify-center lg:py-24">
      <ConveyorBelt />
      <div className="relative flex flex-col gap-4 lg:max-w-[52%]">
        <h1 className="font-heading text-4xl tracking-tight text-balance">
          Runtime economics for agents
        </h1>
        <p className="text-lg text-muted-foreground">
          Give your agents observability into your business with programmable
          resource controls for tokens, tools, time, and more.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href="/access">
              Get access today
              <ArrowRight data-icon="inline-end" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/docs">Read docs</a>
          </Button>
        </div>
      </div>
    </Section>
  );
}
