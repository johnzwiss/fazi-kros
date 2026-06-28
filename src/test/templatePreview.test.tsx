import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplatePreview } from "../components/TemplatePreview";
import type { PlanTemplate } from "../types";

const template: PlanTemplate = {
  id: "preview-plan",
  schemaVersion: 1,
  title: "Previewable plan",
  description: "A two-week example.",
  guidance: ["Keep easy days easy."],
  weeks: [
    { weekNumber: 1, summary: "Settle in", workouts: [{ day: "mon", type: "running", title: "Easy run", plannedMiles: 3 }] },
    { weekNumber: 2, summary: "Build gently", workouts: [{ day: "wed", type: "strength", title: "Full body", plannedMinutes: 40 }] },
  ],
};

describe("TemplatePreview", () => {
  it("shows each week without activating the plan", () => {
    const close = vi.fn();
    render(<TemplatePreview template={template} onClose={close} />);
    expect(screen.getByRole("heading", { name: "Previewable plan" })).toBeInTheDocument();
    expect(screen.getByText("Easy run")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Week 2" }));
    expect(screen.getByText("Full body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done previewing" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
