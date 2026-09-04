import { Check, Minus } from "lucide-react";

import { Ascii } from "./Ascii";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { embeddedGlyph, hostedGlyph, localGlyph } from "@/lib/diagrams";

const modes = [
  {
    name: "Local",
    status: "available",
    glyph: localGlyph,
    desc: "One Node.js process, one private in-memory database. No account, no key, no network. Every Budget disappears when the process exits.",
    tag: "evaluation · tests · short-lived work",
  },
  {
    name: "Embedded PostgreSQL",
    status: "preview",
    glyph: embeddedGlyph,
    desc: "Migrations and procedures installed into a database you already own. Your code owns the transaction, so a Keynes decision and a business row commit — or roll back — together.",
    tag: "teams already operating PostgreSQL",
  },
  {
    name: "Hosted PostgreSQL",
    status: "preview",
    glyph: hostedGlyph,
    desc: "The Keynes service with its own PostgreSQL, self-hosted or run by us. Durable Budgets over the remote SDK, whatever database your application uses.",
    tag: "durable Budgets, nothing to embed",
  },
] as const;

const tableRows: { label: string; values: (string | boolean)[] }[] = [
  { label: "Durable across restarts", values: [false, true, true] },
  { label: "Commits with your own rows", values: [false, true, false] },
  { label: "Runs with no network", values: [true, true, false] },
  {
    label: "Who operates the database",
    values: ["nobody", "you", "you or Keynes"],
  },
  {
    label: "Setup before first request",
    values: ["none", "installer + roles", "api key"],
  },
];

function BooleanValue({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1.5">
      <Check className="size-4" aria-hidden="true" />
      yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Minus className="size-4" aria-hidden="true" />
      no
    </span>
  );
}

export function Deployments() {
  return (
    <Section className="flex flex-col gap-12 py-16">
      <header className="space-y-4">
        <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">
          Three ways to run it
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          The same Budget workflow, whether it lives in your process, inside
          your database, or behind the service. What changes is durability,
          transactions, and who operates it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {modes.map((mode) => (
          <Card key={mode.name}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{mode.name}</CardTitle>
                <Badge
                  variant={
                    mode.status === "available" ? "default" : "secondary"
                  }
                >
                  {mode.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-4">
                <Ascii className="text-[11px] leading-4" html={mode.glyph} />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {mode.desc}
              </p>
              <code className="text-xs">{mode.tag}</code>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Capability</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Embedded PostgreSQL</TableHead>
              <TableHead>Hosted PostgreSQL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                {row.values.map((value, index) => (
                  <TableCell key={`${row.label}-${modes[index].name}`}>
                    {typeof value === "boolean" ? (
                      <BooleanValue value={value} />
                    ) : (
                      value
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
