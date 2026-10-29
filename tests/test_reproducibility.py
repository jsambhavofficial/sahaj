"""Tests for deterministic generation, reproducibility, and seed isolation."""

import pytest
import pandas as pd
from src.config_loader import load_config
from src.generate_profiles import generate_senior_profiles, derive_senior_seed
from src.generate_baselines import generate_senior_baselines
from src.generate_episodes import allocate_scenarios


@pytest.fixture(scope="session")
def config():
    return load_config()


def test_deterministic_reproducibility(config):
    """Verifies that running profile, baseline, and scenario generation twice with same seed produces identical results."""
    profiles_1 = generate_senior_profiles(config)
    profiles_2 = generate_senior_profiles(config)
    pd.testing.assert_frame_equal(profiles_1, profiles_2)

    baselines_1 = generate_senior_baselines(profiles_1, config)
    baselines_2 = generate_senior_baselines(profiles_2, config)
    pd.testing.assert_frame_equal(baselines_1, baselines_2)

    alloc_1 = allocate_scenarios(profiles_1, config)
    alloc_2 = allocate_scenarios(profiles_2, config)
    assert alloc_1 == alloc_2


def test_seed_isolation(config):
    """Verifies that distinct senior IDs derive distinct random streams."""
    seed_s0001 = derive_senior_seed(config.random_seed, "S0001")
    seed_s0002 = derive_senior_seed(config.random_seed, "S0002")
    assert seed_s0001 != seed_s0002

