import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  COMPANY_SIZE_OPTIONS,
  companySizeShort,
  headquarters,
  safeWebsite,
  websiteDomain,
} from "../lib/customer-profile";
import { CompanyLogo } from "./CompanyLogo";
import { TagInput } from "./TagInput";

describe("CompanyLogo", () => {
  it("uses the drawn mark for a known demo customer", () => {
    const { container } = render(<CompanyLogo name="Quarry & Co" />);
    const img = container.querySelector("img[data-logo=drawn]")!;
    expect(img.getAttribute("src")).toContain("logos/quarry-co.svg");
  });

  it("shows initials and keeps the same look for the same company", () => {
    const first = render(<CompanyLogo name="Orchard Retail Group" />);
    expect(first.container).toHaveTextContent("OR");
    const look = first.container
      .querySelector("[data-logo]")!
      .getAttribute("style");
    const again = render(<CompanyLogo name="orchard retail group" size="xl" />);
    expect(
      again.container.querySelector("[data-logo]")!.getAttribute("style"),
    ).toBe(look);
  });

  it("gives different companies different tints across the palette", () => {
    const names = [
      "Alder Health",
      "Brightwater",
      "Cedar & Pine",
      "Harbor Freight",
      "Kestrel",
      "Quarry & Co",
      "Skyline",
    ];
    const tints = new Set(
      names.map((n) =>
        render(<CompanyLogo name={n} />)
          .container.querySelector("[data-logo]")!
          .getAttribute("data-logo"),
      ),
    );
    expect(tints.size).toBeGreaterThan(2);
  });

  it("is decorative and copes with odd names", () => {
    const { container } = render(<CompanyLogo name="  &&  " />);
    expect(container.querySelector("[data-logo]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(render(<CompanyLogo name="Acme" />).container).toHaveTextContent(
      "AC",
    );
  });
});

function Harness({ initial = [] as string[], max = 3 }) {
  const [tags, setTags] = useState(initial);
  return <TagInput id="t" value={tags} onChange={setTags} max={max} />;
}

describe("TagInput", () => {
  const box = () => screen.getByRole("textbox");

  it("adds on Enter or comma, ignoring blanks and duplicates", () => {
    render(<Harness />);
    for (const text of ["Grocery", "grocery", "  ", "Delivery,"]) {
      fireEvent.change(box(), { target: { value: text } });
      fireEvent.keyDown(box(), { key: "Enter" });
    }
    fireEvent.change(box(), { target: { value: "Fleet" } });
    fireEvent.keyDown(box(), { key: "," });
    expect(screen.getByText("Grocery")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Fleet")).toBeInTheDocument();
    expect(screen.queryByText("grocery")).not.toBeInTheDocument();
  });

  it("stops at the limit", () => {
    render(<Harness initial={["a", "b", "c"]} />);
    expect(box()).toBeDisabled();
    expect(box()).toHaveAttribute("placeholder", "Up to 3 tags");
  });

  it("removes a tag with its button or with Backspace on an empty box", () => {
    render(<Harness initial={["a", "b"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove a" }));
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "Backspace" });
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  it("commits what is typed when the box loses focus", () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: "Pending" } });
    fireEvent.blur(box());
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("customer-profile helpers", () => {
  it("labels company sizes", () => {
    expect(COMPANY_SIZE_OPTIONS).toHaveLength(4);
    expect(companySizeShort("1000+")).toBe("1000+ people");
    expect(companySizeShort(null)).toBeNull();
    expect(companySizeShort("huge")).toBeNull();
  });

  it("shortens a website for display and refuses non-web links", () => {
    expect(websiteDomain("https://www.acme.example/about")).toBe(
      "acme.example",
    );
    expect(websiteDomain("not a url")).toBe("not a url");
    expect(safeWebsite("http://a.example")).toBe("http://a.example");
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("data:text/html,x")).toBeNull();
    expect(safeWebsite(null)).toBeNull();
  });

  it("joins the headquarters from whatever is set", () => {
    expect(headquarters({ hq_city: "Turin", hq_country: "Italy" })).toBe(
      "Turin, Italy",
    );
    expect(headquarters({ hq_city: null, hq_country: "Italy" })).toBe("Italy");
    expect(headquarters({ hq_city: null, hq_country: null })).toBeNull();
  });
});
