import { render, screen } from "@testing-library/react";
import { SupplierDashboardHero } from "./SupplierDashboardHero";

describe("SupplierDashboardHero", () => {
  it("renders workspace and status", () => {
    render(
      <SupplierDashboardHero
        t={(key) => key}
        profile={{ status: "DRAFT" } as never}
        isEditable={true}
        error={null}
        notice={null}
      />
    );

    expect(screen.getByText("supplier.workspace")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });
});
