"""Generate synthetic check-in notes and corresponding ground-truth NLP annotations."""

from datetime import timedelta
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd

from src.config_loader import DatasetConfig, load_config
from src.text_corpus import CORPUS, TextTemplate, CueAnnotation

logger = logging.getLogger(__name__)


def generate_checkin_data(
    profiles_df: pd.DataFrame,
    baselines_df: pd.DataFrame,
    allocations: Dict[str, Dict[str, Any]],
    config: DatasetConfig
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generates realistic phone/coordinator check-in interaction notes in Hindi,
    Hinglish, and English along with isolated synthetic ground-truth NLP annotations.
    """
    logger.info("Generating check-in notes and NLP annotations...")

    checkin_rows: List[Dict[str, Any]] = []
    annotation_rows: List[Dict[str, Any]] = []

    checkin_counter = 1
    annotation_counter = 1

    baselines_by_id = baselines_df.set_index("senior_id").to_dict(orient="index")
    start_dt = config.start_date
    total_days = config.observation_days

    channels = ["phone_call", "coordinator_visit", "whatsapp_voice", "app_checkin"]
    channel_weights = [0.70, 0.12, 0.12, 0.06]

    for _, profile in profiles_df.iterrows():
        senior_id = profile["senior_id"]
        senior_seed = profile["synthetic_profile_seed"]
        base = baselines_by_id[senior_id]
        alloc = allocations[senior_id]
        pref_lang = profile["preferred_language"]
        expected_freq = profile["expected_checkin_frequency"]

        rng = np.random.default_rng(senior_seed + 606)

        base_participation = base["baseline_checkin_participation_tendency"]

        for day in range(total_days):
            # Determine if check-in is expected on this day
            if expected_freq == "alternate_days" and (day % 2 != 0):
                continue
            elif expected_freq == "weekly_3x" and (day % 7 not in [1, 3, 5]):
                continue

            current_date = start_dt + timedelta(days=day)
            date_str = current_date.strftime("%Y-%m-%d")

            in_episode = (day >= alloc["onset_day"]) and (day <= alloc["end_day"])
            episode_day = max(0, day - alloc["onset_day"])
            episode_len = max(1, alloc["end_day"] - alloc["onset_day"] + 1)

            progression = 0.0
            if in_episode:
                if alloc["sub_type"] == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY":
                    mid = episode_len * 0.4
                    progression = episode_day / mid if episode_day <= mid else max(0.0, 1.0 - (episode_day - mid) / (episode_len - mid))
                elif alloc["main_type"] == "intermittent":
                    mid = episode_len / 2.0
                    progression = np.exp(-((episode_day - mid) ** 2) / (2 * (episode_len / 3.0) ** 2))
                elif alloc["main_type"] == "acute":
                    progression = 1.0 if episode_day < 5 else max(0.2, 1.0 - (episode_day - 5) * 0.12)
                else:
                    progression = min(1.0, episode_day / max(20.0, float(episode_len)))

            # Check if check-in was successfully completed
            participation_rate = base_participation
            if alloc["sub_type"] == "SCEN_GRADUAL_COGNITIVE_FRAILTY" and progression > 0:
                participation_rate -= progression * 0.25

            if rng.random() > participation_rate:
                # Check-in missed / non-response
                continue

            # Check-in timestamp (typically 09:30 to 18:30)
            hour = int(rng.integers(9, 18))
            minute = int(rng.integers(0, 60))
            second = int(rng.integers(0, 60))
            checkin_ts = f"{date_str} {hour:02d}:{minute:02d}:{second:02d}"

            channel = rng.choice(channels, p=channel_weights)
            source_role = "care_coordinator" if channel in ["phone_call", "coordinator_visit"] else "senior_citizen"

            # Determine dominant category based on scenario
            sub_type = alloc["sub_type"]
            category = "wellbeing"

            if progression > 0:
                if sub_type == "SCEN_GRADUAL_MOBILITY_DECLINE":
                    category = rng.choice(["weakness", "pain", "uncertain"], p=[0.5, 0.35, 0.15])
                elif sub_type == "SCEN_GRADUAL_APPETITE_WEIGHT_LOSS":
                    category = rng.choice(["low_appetite", "weakness"], p=[0.7, 0.3])
                elif sub_type == "SCEN_GRADUAL_COGNITIVE_FRAILTY":
                    category = rng.choice(["confusion", "medication_issue", "low_mood"], p=[0.45, 0.35, 0.20])
                elif sub_type == "SCEN_GRADUAL_DECLINE_WITH_RECOVERY":
                    # If recovering
                    mid = episode_len * 0.4
                    if episode_day > mid:
                        category = rng.choice(["recovery", "wellbeing"], p=[0.75, 0.25])
                    else:
                        category = rng.choice(["weakness", "poor_sleep"], p=[0.6, 0.4])
                elif sub_type == "SCEN_INTERMITTENT_SLEEP_DISRUPTION":
                    category = rng.choice(["poor_sleep", "weakness"], p=[0.75, 0.25])
                elif sub_type == "SCEN_INTERMITTENT_MILD_PAIN_FLARE":
                    category = rng.choice(["pain", "uncertain"], p=[0.8, 0.2])
                elif sub_type == "SCEN_ISOLATED_MEDICATION_OMISSION":
                    category = "medication_issue"
                elif sub_type == "SCEN_ACUTE_FALL_INCIDENT":
                    category = "fall" if episode_day <= 2 else rng.choice(["pain", "weakness", "fear"], p=[0.5, 0.3, 0.2]) if "fear" in CORPUS else "pain"
                elif sub_type == "SCEN_ACUTE_DIZZINESS_ORTHOSTATIC":
                    category = "dizziness"
                elif sub_type == "SCEN_ACUTE_HYPERTENSIVE_CRISIS":
                    category = rng.choice(["dizziness", "uncertain"], p=[0.7, 0.3])
                else:
                    category = rng.choice(["weakness", "poor_sleep", "low_mood"], p=[0.4, 0.3, 0.3])
            else:
                # Outside episode or stable: mostly wellbeing, occasional negation, historical mention
                roll = rng.random()
                if roll < 0.72:
                    category = "wellbeing"
                elif roll < 0.85:
                    category = "negation"
                elif roll < 0.94:
                    category = "historical"
                else:
                    category = "uncertain"

            # Select phrase matching preferred language (or fallback)
            candidates = [t for t in CORPUS.get(category, CORPUS["wellbeing"]) if t.language == pref_lang]
            if not candidates:
                candidates = CORPUS.get(category, CORPUS["wellbeing"])

            chosen_idx = int(rng.integers(0, len(candidates)))
            selected_template: TextTemplate = candidates[chosen_idx]

            # Linguistic variation: add occasional greeting / wrap
            greetings_hi = ["नमस्ते जी। ", "प्रणाम। ", "शुभ प्रभात। ", ""]
            greetings_hing = ["Hello ji, ", "Namaste, ", "Good morning, ", ""]
            greetings_en = ["Hello, ", "Good day, ", "During routine call, ", ""]

            greeting = ""
            if pref_lang == "hindi":
                greeting = rng.choice(greetings_hi)
            elif pref_lang == "hinglish":
                greeting = rng.choice(greetings_hing)
            else:
                greeting = rng.choice(greetings_en)

            final_note = greeting + selected_template.text

            chk_id = f"CHK_{checkin_counter:06d}"
            checkin_counter += 1

            checkin_rows.append({
                "checkin_id": chk_id,
                "senior_id": senior_id,
                "timestamp": checkin_ts,
                "channel": channel,
                "language": pref_lang,
                "raw_note": final_note,
                "transcription_status": "verified" if channel in ["phone_call", "coordinator_visit"] else "auto_transcribed",
                "consent_status": "consented",
                "source_role": source_role,
                "synthetic_scenario_id": alloc["sub_type"],
            })

            # Generate NLP annotations for each ground-truth cue
            for cue in selected_template.cues:
                ann_id = f"ANN_{annotation_counter:06d}"
                annotation_counter += 1

                annotation_rows.append({
                    "annotation_id": ann_id,
                    "checkin_id": chk_id,
                    "cue_type": cue.cue_type,
                    "cue_value": cue.cue_value,
                    "temporal_context": cue.temporal_context,
                    "negation_status": cue.negation_status,
                    "source_role": source_role,
                    "annotation_confidence": cue.confidence,
                    "annotation_source": "synthetic_ground_truth",
                })

    checkins_df = pd.DataFrame(checkin_rows)
    annotations_df = pd.DataFrame(annotation_rows)

    logger.info(f"Generated {len(checkins_df)} check-ins and {len(annotations_df)} NLP annotations.")
    return checkins_df, annotations_df


def save_checkins_and_annotations(
    checkins_df: pd.DataFrame,
    annotations_df: pd.DataFrame,
    raw_dir: Path,
    processed_dir: Path
) -> Tuple[Path, Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    p1 = raw_dir / "checkins.csv"
    p2 = processed_dir / "nlp_annotations.csv"

    checkins_df.to_csv(p1, index=False)
    annotations_df.to_csv(p2, index=False)

    logger.info(f"Saved check-ins to {p1} and NLP annotations to {p2}")
    return p1, p2


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    cfg = load_config()
    p_df = pd.read_csv(cfg.raw_data_dir / "senior_profiles.csv")
    b_df = pd.read_csv(cfg.raw_data_dir / "senior_baselines.csv")
    from src.generate_episodes import allocate_scenarios
    allocs = allocate_scenarios(p_df, cfg)
    c_df, a_df = generate_checkin_data(p_df, b_df, allocs, cfg)
    save_checkins_and_annotations(c_df, a_df, cfg.raw_data_dir, cfg.processed_data_dir)
