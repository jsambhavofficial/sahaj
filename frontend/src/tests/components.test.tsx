import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskBadge } from "../components/ui/RiskBadge";
import { AlertBadge } from "../components/ui/AlertBadge";
import { MetricCard } from "../components/ui/MetricCard";
import { SearchInput } from "../components/ui/SearchInput";
import { Modal } from "../components/ui/Modal";
import { RiskDistributionChart } from "../components/charts/RiskDistributionChart";

describe("UI Components", () => {
  describe("RiskBadge", () => {
    it("renders with correct text and accessible role", () => {
      render(<RiskBadge level="URGENT_REVIEW" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveTextContent("Urgent Review");
      expect(badge).toHaveAttribute("aria-label", "Risk level: Urgent Review");
    });

    it("renders Low risk badge safely", () => {
      render(<RiskBadge level="LOW" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveTextContent("Low Risk");
    });
  });

  describe("AlertBadge", () => {
    it("renders alert status with accessible text", () => {
      render(<AlertBadge status="OPEN" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveTextContent("Active");
      expect(badge).toHaveAttribute("aria-label", "Alert status: Active");
    });
  });

  describe("MetricCard", () => {
    it("renders metric title and value", () => {
      render(
        <MetricCard
          title="Monitored Seniors"
          value={200}
          subtitle="Active cohort"
        />
      );
      expect(screen.getByText("Monitored Seniors")).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("Active cohort")).toBeInTheDocument();
    });

    it("fires onClick handler when clicked", () => {
      const handleClick = vi.fn();
      render(
        <MetricCard
          title="Active Alerts"
          value={5}
          onClick={handleClick}
        />
      );
      const card = screen.getByRole("button");
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("SearchInput", () => {
    it("renders with placeholder and triggers onChange", () => {
      const handleChange = vi.fn();
      render(
        <SearchInput
          value=""
          onChange={handleChange}
          placeholder="Search test..."
        />
      );
      const input = screen.getByPlaceholderText("Search test...");
      fireEvent.change(input, { target: { value: "S0001" } });
      expect(handleChange).toHaveBeenCalledWith("S0001");
    });

    it("clears search input when clear button clicked", () => {
      const handleChange = vi.fn();
      render(
        <SearchInput
          value="S0001"
          onChange={handleChange}
        />
      );
      const clearBtn = screen.getByRole("button", { name: /clear/i });
      fireEvent.click(clearBtn);
      expect(handleChange).toHaveBeenCalledWith("");
    });
  });

  describe("Modal", () => {
    it("renders when isOpen is true and dismisses on Escape", () => {
      const handleClose = vi.fn();
      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Test Modal"
        >
          <p>Modal body content</p>
        </Modal>
      );
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
      expect(screen.getByText("Modal body content")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not render when isOpen is false", () => {
      render(
        <Modal
          isOpen={false}
          onClose={vi.fn()}
          title="Hidden Modal"
        >
          <p>Content</p>
        </Modal>
      );
      expect(screen.queryByText("Hidden Modal")).not.toBeInTheDocument();
    });
  });

  describe("RiskDistributionChart", () => {
    it("renders distribution breakdown accurately", () => {
      const dist = {
        LOW: 120,
        MODERATE: 50,
        HIGH: 20,
        URGENT_REVIEW: 10,
      };
      render(<RiskDistributionChart distribution={dist} total={200} />);
      expect(screen.getByText("Cohort Risk Distribution")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });
});

