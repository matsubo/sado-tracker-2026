import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "@/state/AppProviders";

/** Render under the same providers the root layout mounts. */
export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
  return render(ui, { wrapper: AppProviders, ...options });
}
