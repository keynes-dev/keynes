import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { EvalsChart } from "./EvalsChart";
import { FrontierChart } from "./FrontierChart";
import { HeroResourcesChart } from "./HeroResourcesChart";
import { WorkflowsChart } from "./WorkflowsChart";

afterEach(cleanup);

describe("homepage charts", () => {
  test("names the resource allocation chart for assistive technology", () => {
    render(<HeroResourcesChart />);

    const chart = screen.getByRole("img", {
      name: "Reserved and available resources by scope",
    });

    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("viewBox", "0 0 320 108");
    for (const label of ["tokens", "toolCalls", "retries", "escalations"]) {
      expect(screen.getByText(label)).toHaveAttribute("text-anchor", "start");
    }
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  test("names the workflow usage chart and preserves its settlement context", () => {
    render(<WorkflowsChart />);

    expect(
      screen.getByRole("img", {
        name: "Workflow token usage and held reservation",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/support-workflow · reserved 1,500 tokens/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/used 1,300 · returned 200 to parent at settle/i),
    ).toBeInTheDocument();
  });

  test("names the evaluation trade-off chart and preserves its conclusion", () => {
    render(<EvalsChart />);

    expect(
      screen.getByRole("img", {
        name: "Evaluation cost and denial trade-off",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("tighter ceilings cost less and deny more"),
    ).toBeInTheDocument();
  });

  test("names the efficiency frontier and preserves its conclusion", () => {
    render(<FrontierChart />);

    expect(
      screen.getByRole("img", {
        name: "Token spend and resolved outcome frontier",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("more spend, worse outcomes")).toBeInTheDocument();
  });
});
