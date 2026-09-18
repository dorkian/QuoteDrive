import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the QuoteDrive header", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "QuoteDrive" }),
    ).toBeInTheDocument();
  });
});
