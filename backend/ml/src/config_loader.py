"""Configuration loader and validator for SamarthCare AI dataset generation."""

from dataclasses import dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any
import math
import yaml


@dataclass
class DatasetConfig:
    schema_version: str
    cohort_size: int
    observation_start_date: str
    observation_days: int
    random_seed: int
    output_directory: str
    city_count: int
    cities: List[str]
    coordinator_count: int
    language_distribution: Dict[str, float]
    scenario_proportions: Dict[str, float]
    sub_scenarios: Dict[str, List[str]]
    missingness_settings: Dict[str, float]
    measurement_frequency_settings: Dict[str, Any]
    raw_data_dir: Path = field(init=False)
    processed_data_dir: Path = field(init=False)
    evaluation_data_dir: Path = field(init=False)

    def __post_init__(self):
        base_dir = Path(self.output_directory)
        self.raw_data_dir = base_dir / "raw"
        self.processed_data_dir = base_dir / "processed"
        self.evaluation_data_dir = base_dir / "evaluation"

    @property
    def start_date(self) -> date:
        return datetime.strptime(self.observation_start_date, "%Y-%m-%d").date()


def load_config(config_path: str | Path = "config/dataset_config.yaml") -> DatasetConfig:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Configuration file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    # Validate mandatory fields
    required_fields = [
        "schema_version",
        "cohort_size",
        "observation_start_date",
        "observation_days",
        "random_seed",
        "output_directory",
        "city_count",
        "coordinator_count",
        "language_distribution",
        "scenario_proportions",
        "missingness_settings",
        "measurement_frequency_settings",
    ]
    for req in required_fields:
        if req not in data:
            raise ValueError(f"Missing required configuration key: {req}")

    if data["cohort_size"] <= 0:
        raise ValueError("cohort_size must be a positive integer.")
    if data["observation_days"] <= 0:
        raise ValueError("observation_days must be a positive integer.")

    # Validate dates
    try:
        datetime.strptime(data["observation_start_date"], "%Y-%m-%d")
    except ValueError as e:
        raise ValueError(f"Invalid observation_start_date format. Expected YYYY-MM-DD: {e}")

    # Validate scenario proportions sum to 1.0
    scenario_sum = sum(data["scenario_proportions"].values())
    if not math.isclose(scenario_sum, 1.0, rel_tol=1e-5, abs_tol=1e-5):
        raise ValueError(f"scenario_proportions must sum to 1.0, got: {scenario_sum}")

    # Validate language distribution sum to 1.0
    lang_sum = sum(data["language_distribution"].values())
    if not math.isclose(lang_sum, 1.0, rel_tol=1e-5, abs_tol=1e-5):
        raise ValueError(f"language_distribution must sum to 1.0, got: {lang_sum}")

    return DatasetConfig(
        schema_version=data["schema_version"],
        cohort_size=int(data["cohort_size"]),
        observation_start_date=str(data["observation_start_date"]),
        observation_days=int(data["observation_days"]),
        random_seed=int(data["random_seed"]),
        output_directory=str(data["output_directory"]),
        city_count=int(data["city_count"]),
        cities=data.get("cities", [f"CITY_{i:02d}" for i in range(1, data["city_count"] + 1)]),
        coordinator_count=int(data["coordinator_count"]),
        language_distribution=data["language_distribution"],
        scenario_proportions=data["scenario_proportions"],
        sub_scenarios=data.get("sub_scenarios", {}),
        missingness_settings=data["missingness_settings"],
        measurement_frequency_settings=data["measurement_frequency_settings"],
    )

