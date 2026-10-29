"""
Stage 1 — Time-Gap-Aware Damped Holt Filter
============================================
A stateful exponential smoothing filter that tracks the level (L) and trend (B)
of an irregularly-sampled time series. When readings are missing for Δt days,
the trend is damped by φ^Δt so that forecasts don't drift unboundedly.

Design choices
--------------
α = 0.35  — level smoothing: moderately responsive to new readings
β = 0.20  — trend smoothing: slower, avoids over-reacting to noise
φ = 0.88  — per-day trend damping factor

For a gap of Δt days the effective damping is φ^Δt:
  Δt=1 → ×0.88  (standard day-to-day)
  Δt=3 → ×0.68  (2 missed days, trend cooled significantly)
  Δt=7 → ×0.43  (missed a week, trend nearly halved)

All arithmetic is in "deviation from baseline" space so the filter state
is mean-zero at initialization and remains interpretable.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import numpy as np


# ── Default hyperparameters ────────────────────────────────────────────────────
ALPHA = 0.35   # level learning rate
BETA  = 0.20   # trend learning rate
PHI   = 0.88   # per-day trend damping


@dataclass
class HoltState:
    """Snapshot of filter state at a single time step."""
    L: float          # smoothed level (deviation from baseline)
    B: float          # smoothed trend (units per day)
    delta_B: float    # change in trend since last update
    t: float          # absolute time index (fractional days allowed)


class DampedHoltFilter:
    """
    Stateful Damped Holt-Winters Level+Trend filter.

    Usage (per senior, per vital sign):
        flt = DampedHoltFilter(alpha=0.35, beta=0.20, phi=0.88)
        for delta_y, delta_t in zip(deviations, gaps):
            state = flt.update(delta_y, delta_t)
        forecast_h1 = flt.forecast(h=1)

    Parameters
    ----------
    alpha : float
        Level smoothing weight in (0, 1). Higher → more reactive.
    beta : float
        Trend smoothing weight in (0, 1). Higher → trend adapts faster.
    phi : float
        Per-day trend damping factor in (0, 1). Controls how quickly
        the trend decays during forecast horizons.
    """

    def __init__(
        self,
        alpha: float = ALPHA,
        beta: float  = BETA,
        phi: float   = PHI,
    ):
        self.alpha = alpha
        self.beta  = beta
        self.phi   = phi

        # Internal state — None until first observation
        self._L: Optional[float] = None
        self._B: float = 0.0
        self._t: float = 0.0
        self._prev_B: float = 0.0

        self.history: List[HoltState] = []

    # ── public API ─────────────────────────────────────────────────────────────

    def update(self, delta_y: float, delta_t: float = 1.0) -> HoltState:
        """
        Ingest one new observation and update the filter state.

        Parameters
        ----------
        delta_y : float
            Deviation of the new reading from the senior's personal baseline
            (y_observed − baseline_median).  Units: same as the vital sign.
        delta_t : float
            Days since the last reading. Normally 1.0; larger values occur
            when sensors are offline or the senior misses a reading.

        Returns
        -------
        HoltState with the updated level, trend, and delta_B.
        """
        delta_t = max(delta_t, 1e-6)  # guard against zero-gap edge cases

        if self._L is None:
            # Cold-start: seed level from first observation, trend = 0
            self._L = delta_y
            self._B = 0.0
            self._t = delta_t
        else:
            # Damp the trend by φ^Δt for the gap before applying new obs
            phi_dt = self.phi ** delta_t
            B_damped = phi_dt * self._B

            # Propagate state forward by the gap (predict then correct)
            L_prior = self._L + B_damped * delta_t

            # Holt update equations
            L_new = self.alpha * delta_y + (1 - self.alpha) * L_prior
            B_new = self.beta * (L_new - self._L) / delta_t + (1 - self.beta) * B_damped

            self._prev_B = self._B
            delta_B      = B_new - self._prev_B

            self._L = L_new
            self._B = B_new
            self._t += delta_t

        state = HoltState(
            L       = self._L,
            B       = self._B,
            delta_B = self._B - self._prev_B,
            t       = self._t,
        )
        self.history.append(state)
        return state

    def forecast(self, h: float) -> float:
        """
        Damped-trend forecast h days ahead from current state.

        The damped sum  Σ_{i=1}^{h} φ^i  converges as φ → 0 and approaches
        h as φ → 1.  For fractional h the continuous version is used.

        Returns
        -------
        Predicted deviation from baseline h days from now.
        """
        if self._L is None:
            return 0.0
        # Damped trend cumulative sum: φ(1 − φ^h) / (1 − φ)
        if abs(1 - self.phi) < 1e-9:
            damped_sum = h
        else:
            damped_sum = self.phi * (1 - self.phi ** h) / (1 - self.phi)
        return self._L + self._B * damped_sum

    def reset(self):
        """Reset state — call between seniors."""
        self._L      = None
        self._B      = 0.0
        self._t      = 0.0
        self._prev_B = 0.0
        self.history = []

    @property
    def state(self) -> Optional[HoltState]:
        return self.history[-1] if self.history else None


# ── Batch helper ───────────────────────────────────────────────────────────────

def run_holt_over_series(
    delta_y_series: List[float],
    delta_t_series: List[float],
    alpha: float = ALPHA,
    beta: float  = BETA,
    phi: float   = PHI,
) -> List[Dict]:
    """
    Run the Holt filter over an entire series and return a list of feature dicts.

    Each output dict contains:
        L_t      — smoothed level at time t
        B_t      — smoothed trend at time t
        dB_t     — Δtrend (momentum signal)
        yhat_h1  — 1-day-ahead forecast
        yhat_h3  — 3-day-ahead forecast
        yhat_h5  — 5-day-ahead forecast

    Parameters
    ----------
    delta_y_series : list of float
        Baseline-centred readings in chronological order.
    delta_t_series : list of float
        Time gap before each reading (in days).  First element is ignored
        (cold-start), subsequent elements are the inter-reading gaps.
    """
    flt = DampedHoltFilter(alpha=alpha, beta=beta, phi=phi)
    results = []
    for dy, dt in zip(delta_y_series, delta_t_series):
        flt.update(dy, dt)
        results.append({
            "L_t"     : flt._L,
            "B_t"     : flt._B,
            "dB_t"    : flt.history[-1].delta_B,
            "yhat_h1" : flt.forecast(1),
            "yhat_h3" : flt.forecast(3),
            "yhat_h5" : flt.forecast(5),
        })
    return results
