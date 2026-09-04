import { useEffect, useState } from "react";

import { BudgetsFigure } from "./BudgetsFigure";
import { HOW_IT_WORKS_CHART_BLOCK_HEIGHT } from "./ChartFrame";
import { EvalsChart } from "./EvalsChart";
import { PoliciesFigure } from "./PoliciesFigure";
import { WorkflowsChart } from "./WorkflowsChart";
import { Section } from "@/components/Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

const TICK_MS = 8_000;

const items = [
  {
    value: "budgets",
    label: "Budgets",
    body: "A Budget holds many Resources at once and hands them down. A request is one envelope: it either reserves every Resource it asked for and returns a child Budget, or one Resource falls short and the whole request is denied with nothing reserved.",
    mono: "budget.request({ tokens: 2400, toolCalls: 9 })",
    caption: "org to run · three Resources · one denied step",
    Chart: BudgetsFigure,
  },
  {
    value: "policies",
    label: "Policies",
    body: "Constraints are written in a typed TypeScript builder and compiled to one restricted SQL subset. When Policies disagree, the lowest ceiling wins. A request above that ceiling is denied outright — Keynes never revises the quantities you asked for.",
    mono: "when leadScore >= 80",
    caption: "four ceilings · one binds · request denied",
    Chart: PoliciesFigure,
  },
  {
    value: "workflows",
    label: "Workflows",
    body: "Your application owns execution. Keynes holds the reservation while the workflow runs, then the Budget settles with what was actually used — unused Resources return to the parent.",
    mono: "budget.settle({ tokens: 1300 })",
    caption: "reserve · run · settle",
    Chart: WorkflowsChart,
  },
  {
    value: "evals",
    label: "Evals",
    body: "Every Budget command leaves canonical evidence in the projection and history. Your harness compares variants by what they actually cost and what they denied — Keynes records the facts; you decide what they mean.",
    mono: "47 settled runs · 3 variants",
    caption: "evidence for every command",
    Chart: EvalsChart,
  },
] as const;

export function HowItWorks() {
  const [active, setActive] = useState<(typeof items)[number]["value"]>(
    items[0].value,
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActive((current) => {
        const index = items.findIndex((item) => item.value === current);
        return items[(index + 1) % items.length].value;
      });
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [active]);

  const activeItem = items.find((item) => item.value === active) ?? items[0];
  const ActiveChart = activeItem.Chart;

  return (
    <Section className="flex flex-col gap-12">
      <header className="space-y-4">
        <h2 className="font-heading text-3xl tracking-tight">How it works</h2>
        <p className="text-muted-foreground">
          Budgets hold Resources. Policies constrain them. Workflows spend them.
          Evidence tells you what it cost.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        <Accordion
          className="w-full"
          onValueChange={(value) => {
            if (value) {
              setActive(value as (typeof items)[number]["value"]);
            }
          }}
          type="single"
          value={active}
        >
          {items.map((item, index) => (
            <AccordionItem
              className="flex border-b last:border-b-0"
              key={item.value}
              value={item.value}
            >
              <div
                aria-hidden
                className="relative w-1 shrink-0 self-stretch bg-muted"
              >
                {active === item.value ? (
                  <span
                    className="tab-progress absolute inset-x-0 top-0 block w-full bg-primary motion-reduce:h-full"
                    key={active}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&_[data-slot=accordion-trigger-icon]]:hidden">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-base">{item.label}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-2">
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          ))}
        </Accordion>

        <Card className="h-full w-full min-w-0">
          <CardContent className="px-0">
            <div className="min-w-0 w-full overflow-x-hidden p-4 sm:p-5">
              <div
                className="h-full min-w-0 w-full"
                style={{ height: HOW_IT_WORKS_CHART_BLOCK_HEIGHT }}
              >
                <ActiveChart />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
