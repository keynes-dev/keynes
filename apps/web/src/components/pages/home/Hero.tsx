import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ConveyorBelt } from "./ConveyorBelt";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";

// Wide enough to set the text beside the machine. Below this the two would have
// to share the same space and the text would be the one to suffer, so the
// drawing goes under it instead of behind it.
const ROOM_BESIDE = "(min-width: 64rem)";

export function Hero() {
  // Which of the two the drawing is depends on the viewport, so it is read
  // rather than expressed in classes: the same element cannot be a background
  // at one width and a block in the flow at another.
  const [beside, setBeside] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(ROOM_BESIDE);
    const read = () => setBeside(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  return (
    <Section
      background={beside ? <ConveyorBelt aside /> : undefined}
      className="flex flex-col justify-center py-24 lg:min-h-[32rem]"
    >
      <div className="flex flex-col gap-4 lg:max-w-[52%]">
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
      {!beside && <ConveyorBelt />}
    </Section>
  );
}
