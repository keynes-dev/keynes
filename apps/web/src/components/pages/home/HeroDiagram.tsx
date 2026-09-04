import { Arrow } from "./Arrow";
import { Ascii } from "./Ascii";
import { HeroResourcesChart } from "./HeroResourcesChart";
import { Section } from "@/components/Section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { heroPolicy, heroRequest, heroResponse } from "@/lib/diagrams";

export function HeroDiagram() {
  return (
    <Section className="flex flex-col items-center gap-6 xl:flex-row">
      <Card className="w-full min-w-0 xl:flex-1">
        <CardHeader className="border-b">
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="p-4 sm:p-5">
            <HeroResourcesChart />
          </div>
        </CardContent>
      </Card>
      <div className="hidden shrink-0 text-muted-foreground xl:block">
        <Arrow />
      </div>
      <div className="text-muted-foreground xl:hidden">
        <Arrow length={40} vertical />
      </div>
      <Card className="w-full min-w-0 xl:flex-1">
        <CardHeader className="border-b">
          <CardTitle>Policy</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Ascii className="p-4" html={heroPolicy} />
        </CardContent>
      </Card>
      <div className="hidden shrink-0 text-muted-foreground xl:block">
        <Arrow />
      </div>
      <div className="text-muted-foreground xl:hidden">
        <Arrow length={40} vertical />
      </div>
      <Card className="w-full min-w-0 xl:flex-1">
        <CardHeader className="border-b">
          <CardTitle>Agent</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="border-b bg-muted/50 px-4 py-2 font-mono text-xs text-muted-foreground">
            request
          </div>
          <Ascii className="p-4" html={heroRequest} />
          <div className="flex items-center justify-between border-y bg-muted/50 px-4 py-2 font-mono text-xs text-muted-foreground">
            <span>response</span>
            <span className="text-destructive">[x] DENIED</span>
          </div>
          <Ascii
            className="bg-foreground p-4 text-background"
            html={heroResponse}
          />
        </CardContent>
      </Card>
    </Section>
  );
}
