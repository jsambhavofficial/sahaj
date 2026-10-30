import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import {
  buildEmbedUrl,
  createIframeEventListener,
  DEFAULT_VOICE_SCENARIO_ID,
  TOUGHTONGUE_ORIGIN,
} from "../lib/ttai";
import SeniorVoiceCompanionModal from "../components/voice/SeniorVoiceCompanionModal";
import { AuthProvider } from "../context/AuthContext";
import { defaultApiClient } from "../services/apiClient";
import SeniorDashboardPage from "../app/senior/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/senior",
  useParams: () => ({}),
}));

describe("ToughTongue AI Voice Agent Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("buildEmbedUrl generates correct embed URL with scenario 6ae34f422e70c63b232d1dd4 and senior dynamic variables", () => {
    const urlString = buildEmbedUrl({
      scenarioId: DEFAULT_VOICE_SCENARIO_ID,
      embedStyle: "basic",
      userName: "Ramesh Gupta",
      userEmail: "ramesh@example.com",
      dynamicVariables: {
        senior_name: "Ramesh Gupta",
        senior_id: "S0001",
        preferred_language: "Hindi",
      },
      languageCode: "hi",
    });

    const parsed = new URL(urlString);
    expect(parsed.origin).toBe("https://app.toughtongueai.com");
    expect(parsed.pathname).toBe(`/embed/basic/${DEFAULT_VOICE_SCENARIO_ID}`);
    expect(parsed.searchParams.get("userName")).toBe("Ramesh Gupta");
    expect(parsed.searchParams.get("userEmail")).toBe("ramesh@example.com");
    expect(parsed.searchParams.get("t_senior_name")).toBe("Ramesh Gupta");
    expect(parsed.searchParams.get("t_senior_id")).toBe("S0001");
    expect(parsed.searchParams.get("languageCode")).toBe("hi");
  });

  it("createIframeEventListener receives and normalizes onStart and onStop events from ToughTongue origin", () => {
    const onStartMock = vi.fn();
    const onStopMock = vi.fn();

    const cleanup = createIframeEventListener({
      onStart: onStartMock,
      onStop: onStopMock,
    });

    // Simulate Format A message
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: TOUGHTONGUE_ORIGIN,
        data: {
          event: "onStart",
          sessionId: "sess_voice_test_999",
          scenarioId: DEFAULT_VOICE_SCENARIO_ID,
          timestamp: 1729000000000,
        },
      })
    );

    expect(onStartMock).toHaveBeenCalledTimes(1);
    expect(onStartMock.mock.calls[0][0].data.session_id).toBe("sess_voice_test_999");

    // Simulate Format B message
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: TOUGHTONGUE_ORIGIN,
        data: {
          type: "onStop",
          data: {
            session_id: "sess_voice_test_999",
            duration_seconds: 45,
          },
        },
      })
    );

    expect(onStopMock).toHaveBeenCalledTimes(1);
    expect(onStopMock.mock.calls[0][0].data.duration_seconds).toBe(45);

    cleanup();
  });

  it("SeniorVoiceCompanionModal renders iframe with microphone permissions and closes on click", async () => {
    const handleClose = vi.fn();

    // Mock fetchSAT
    vi.spyOn(defaultApiClient, "post").mockResolvedValue({
      success: false,
      configured: false,
      scenario_id: DEFAULT_VOICE_SCENARIO_ID,
      iframe_src: `https://app.toughtongueai.com/embed/basic/${DEFAULT_VOICE_SCENARIO_ID}`,
      message: "Direct embed active",
    });

    render(
      <SeniorVoiceCompanionModal
        isOpen={true}
        onClose={handleClose}
        seniorName="Savitri Devi"
        seniorId="S0054"
      />
    );

    expect(screen.getByText(/AI Saathi \(Priya\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Surakshit Voice Call/i)).toBeInTheDocument();

    await waitFor(() => {
      const iframe = screen.getByTitle(/Sahaj AI Saathi Voice Agent/i);
      expect(iframe).toBeInTheDocument();
      expect(iframe.getAttribute("allow")).toContain("microphone");
    });

    const closeBtn = screen.getByText(/Band Karein \(Close\)/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it("Senior Dashboard renders 'AI Saathi se Baat Karein' buttons and opens the voice modal when clicked", async () => {
    vi.spyOn(defaultApiClient, "get").mockResolvedValue({
      senior_id: "S0001",
      senior_name: "Ramesh Gupta",
      age: 74,
      city_name: "Chandigarh",
      living_arrangement: "independent",
      preferred_language: "Hindi",
      next_scheduled_visit: null,
      latest_checkin: null,
      today_status_message: "Sabhi zaroori suraksha maanak theek hain.",
      care_team: {
        coordinator_name: "Sunita Verma",
        office_phone: "0172-2740000",
        hours: "9 AM - 6 PM",
        city_name: "Chandigarh",
      },
      disclaimer: "DPDP Act compliant",
    });

    vi.spyOn(defaultApiClient, "post").mockResolvedValue({
      success: false,
      configured: false,
      scenario_id: DEFAULT_VOICE_SCENARIO_ID,
      iframe_src: `https://app.toughtongueai.com/embed/basic/${DEFAULT_VOICE_SCENARIO_ID}`,
    });

    render(<SeniorDashboardPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/Ramesh Gupta Ji/i)).toBeInTheDocument();
    });

    // Check for "AI Saathi se Baat Karein" button
    const voiceButtons = screen.getAllByRole("button", { name: /AI Saathi se Baat Karein/i });
    expect(voiceButtons.length).toBeGreaterThanOrEqual(1);

    // Click to open modal
    fireEvent.click(voiceButtons[0]);

    // Verify modal is open
    expect(screen.getByRole("dialog", { name: /AI Saathi Voice Companion/i })).toBeInTheDocument();
  });
});
