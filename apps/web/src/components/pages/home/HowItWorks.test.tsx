import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HowItWorks } from "./HowItWorks";

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe("HowItWorks", () => {
  beforeEach(() => {
    stubReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("starts on Budgets and supports manual accordion selection", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);

    expect(screen.getByRole("button", { name: /budgets/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("img", {
        name: /budget cascade from org to run: 3 steps reserved, 1 denied/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /policies/i }));

    expect(screen.getByRole("button", { name: /policies/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("img", {
        name: /four policy ceilings.*binds.*denied/i,
      }),
    ).toBeInTheDocument();
  });

  test("advances to the next section after eight seconds", () => {
    vi.useFakeTimers();
    render(<HowItWorks />);

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByRole("button", { name: /policies/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("img", {
        name: /four policy ceilings.*binds.*denied/i,
      }),
    ).toBeInTheDocument();
  });

  test("does not auto-advance when reduced motion is requested", () => {
    vi.useFakeTimers();
    stubReducedMotion(true);
    render(<HowItWorks />);

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(screen.getByRole("button", { name: /budgets/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("img", {
        name: /budget cascade from org to run: 3 steps reserved, 1 denied/i,
      }),
    ).toBeInTheDocument();
  });
});
