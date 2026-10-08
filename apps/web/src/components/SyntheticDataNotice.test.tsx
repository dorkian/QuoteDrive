import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SyntheticDataNotice } from "./SyntheticDataNotice";

describe("SyntheticDataNotice", () => {
  it("states that the data is synthetic", () => {
    render(<SyntheticDataNotice />);
    expect(screen.getByText(/Synthetic demo data/)).toBeInTheDocument();
  });
});
