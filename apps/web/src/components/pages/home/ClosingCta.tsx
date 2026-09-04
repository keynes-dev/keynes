import { ArrowRight } from "lucide-react";

import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <Section className="flex flex-col items-center gap-8 py-24 text-center">
      <h2 className="font-heading text-4xl tracking-tight text-balance sm:text-5xl">
        Put your agents on a Budget
      </h2>
      <p className="max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
        Apache-2.0 open core. One TypeScript SDK. Start locally with zero setup
        — no account, no keys, no network.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
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
