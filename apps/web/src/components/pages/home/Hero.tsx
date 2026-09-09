import { ArrowRight } from "lucide-react";

import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    // The drawing is clipped to the container rather than run across the whole
    // section, so its grid stops at the same rules everything else on the page
    // lines up with.
    <Section className="relative flex min-h-[40rem] flex-col justify-start overflow-hidden pt-12 pb-24 lg:min-h-[32rem] lg:justify-center lg:py-24">
      {/*
        The conveyor animation, drawn behind the text: the ground grid fills the
        whole of the section and the machine stands in one corner of it. Where
        in the frame it stands is settled inside the drawing from the width of
        this element, so there is nothing to pass it and no state here to fall
        out of step with the `lg:` rules below.

        A tag rather than a component so that this section needs no hydrating:
        it is otherwise all text and links. `pages/index.astro` is what defines
        the tag; importing the module here would not work, since nothing in this
        file is ever run in the browser.

        The label is on the element itself, so it stands whether or not the
        script that fills the element in ever arrives.
      */}
      <conveyor-belt
        // The drawing is drawn in this element's own colours, so they are set
        // here rather than in the drawing: `text-*` is the ink, `bg-*` the
        // ground, `border-*` the grid's rule, and a `dark:` variant on any of
        // them is followed. Only the ink is worth stating — the other two
        // already fall back to the card's own, and giving this element a
        // background would only paint one behind a canvas that covers it.
        // Never in the way of selecting the text it sits under.
        className="pointer-events-none absolute inset-0 bg-background text-primary border-border"
        role="img"
        aria-label="A machine sorting shapes into boxes on a conveyor belt: each box receives the shape that fits the hole in its lid, and one that arrives the wrong way up is turned over by a mechanical arm."
      />
      <div className="relative flex flex-col gap-4 lg:max-w-[50%]">
        <h1 className="font-heading text-4xl tracking-tight text-balance">
          Runtime economics for agents
        </h1>
        <p className="text-lg">
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
