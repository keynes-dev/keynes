import { FrontierChart } from "./FrontierChart";
import { Section } from "@/components/Section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  {
    label: "evidence",
    body: "Every settled Budget records what was requested, what was actually used, and what came back unspent.",
  },
  {
    label: "frontier",
    body: "Your harness ranks configurations by what they cost and what they resolved. The curve is the best you can buy at each price.",
  },
  {
    label: "ceiling",
    body: "The point you choose becomes a Policy ceiling. Keynes enforces it on every request, before the tokens are spent.",
  },
];

export function Frontier() {
  return (
    <Section className="flex flex-col gap-12 py-16">
      <header className="space-y-4">
        <h2 className="max-w-3xl font-heading text-3xl tracking-tight sm:text-4xl">
          Find the knee before production finds it for you
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Past a certain point, more tokens stop buying better outcomes — and
          ungoverned agents slide off the frontier entirely, paying more to
          resolve less. Keynes lets you draw that line in advance, instead of
          finding it in next month&apos;s invoice.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <CardTitle>Efficient frontier</CardTitle>
            <CardDescription className="font-mono text-xs">
              % resolved · tokens spent per ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="p-4 sm:p-5">
              <FrontierChart />
            </div>
          </CardContent>
        </Card>

        <ol className="grid gap-3">
          {steps.map((step, index) => (
            <li className="rounded-xl border bg-card p-5" key={step.label}>
              <div className="mb-2 flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-mono text-base">{step.label}</h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
