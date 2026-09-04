import { ArrowRight } from "lucide-react";

import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <Section className="flex flex-col gap-4 py-24">
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
    </Section>
  );
}
