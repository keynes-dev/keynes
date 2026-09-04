import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { policiesData, POLICY_REQUEST_TOKENS } from "@/lib/charts";

import { PoliciesFigure } from "./PoliciesFigure";

describe("PoliciesFigure", () => {
  test("evaluates four ceilings against a request and denies at the bind", () => {
    render(<PoliciesFigure />);

    expect(
      screen.getByRole("img", {
        name: /four policy ceilings.*binds.*denied/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("when leadScore >= 80")).toBeInTheDocument();

    for (const policy of policiesData) {
      expect(screen.getByText(policy.name)).toBeInTheDocument();
      expect(
        screen.getByText(`<= ${policy.ceiling.toLocaleString()}`),
      ).toBeInTheDocument();
    }

    expect(screen.getByText("request")).toBeInTheDocument();
    expect(
      screen.getByText(POLICY_REQUEST_TOKENS.toLocaleString()),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ok")).toHaveLength(3);
    expect(screen.getByText("BINDS")).toBeInTheDocument();
    expect(screen.getByText("DENIED")).toBeInTheDocument();
  });
});
