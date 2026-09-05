// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBox } from "@/components/tracker/FilterBox";

afterEach(cleanup);

function setup(value = "") {
  const onChange = vi.fn();
  render(
    <FilterBox
      value={value}
      onChange={onChange}
      placeholder="名前かゼッケン番号で絞り込む"
      label="名前かゼッケン番号で一覧を絞り込む"
    />,
  );
  return { onChange, input: screen.getByLabelText("名前かゼッケン番号で一覧を絞り込む") };
}

describe("FilterBox", () => {
  it("hands the typed text up once the typing pauses", async () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "古謝" } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("古謝"));
  });

  it("does not fire a request for every keystroke", async () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: "古" } });
    fireEvent.change(input, { target: { value: "古謝" } });
    fireEvent.change(input, { target: { value: "古謝 孝" } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("古謝 孝"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("offers a way out only once there is something to clear", async () => {
    const { onChange, input } = setup();
    expect(screen.queryByLabelText("絞り込みを解除")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "1043" } });
    await waitFor(() => expect(screen.getByLabelText("絞り込みを解除")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("絞り込みを解除"));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(""));
    expect(input).toHaveValue("");
  });

  it("follows a value handed down from outside", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterBox value="古謝" onChange={onChange} placeholder="p" label="l" />,
    );
    expect(screen.getByLabelText("l")).toHaveValue("古謝");

    rerender(<FilterBox value="" onChange={onChange} placeholder="p" label="l" />);
    await waitFor(() => expect(screen.getByLabelText("l")).toHaveValue(""));
  });

  it("does not report a value it was already given", async () => {
    const onChange = vi.fn();
    render(<FilterBox value="古謝" onChange={onChange} placeholder="p" label="l" />);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onChange).not.toHaveBeenCalled();
  });
});
