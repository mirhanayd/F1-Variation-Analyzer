"""Generate backend-served replay artifacts from FastF1.

FastF1 is intentionally isolated from the React application. The generated JSON
uses the gateway's normalized field names and can be copied into
server/generated-replays for HTTP/WS playback.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fastf1
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "generated-replays"
DEFAULT_CACHE_DIR = ROOT / ".fastf1-cache"


def json_value(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().astimezone(timezone.utc).isoformat()
    if hasattr(value, "total_seconds"):
        return value.total_seconds()
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def iso_timestamp(session_start: pd.Timestamp, elapsed: Any) -> str | None:
    if pd.isna(elapsed):
        return None
    timestamp = session_start + elapsed
    return timestamp.to_pydatetime().astimezone(timezone.utc).isoformat()


def driver_metadata(session: Any, driver_number: str) -> dict[str, Any]:
    result = session.get_driver(driver_number)
    color = json_value(result.get("TeamColor")) or "FFFFFF"
    return {
        "driverNumber": int(driver_number),
        "acronym": json_value(result.get("Abbreviation")) or driver_number,
        "broadcastName": json_value(result.get("BroadcastName")),
        "fullName": json_value(result.get("FullName")),
        "teamName": json_value(result.get("TeamName")),
        "teamColor": color if str(color).startswith("#") else f"#{color}",
        "headshotUrl": json_value(result.get("HeadshotUrl")),
    }


def build_driver_samples(session: Any, driver_number: str) -> list[dict[str, Any]]:
    position = session.pos_data.get(driver_number)
    car = session.car_data.get(driver_number)
    if position is None or position.empty:
        return []

    position = position.copy().sort_values("SessionTime")
    if car is not None and not car.empty:
        car = car.copy().sort_values("SessionTime")
        columns = [column for column in ["SessionTime", "Speed", "Throttle", "Brake", "nGear", "RPM", "DRS"] if column in car]
        position = pd.merge_asof(
            position,
            car[columns],
            on="SessionTime",
            direction="nearest",
            tolerance=pd.Timedelta(milliseconds=500),
        )

    samples: list[dict[str, Any]] = []
    for row in position.itertuples(index=False):
        values = row._asdict()
        samples.append({
            "date": iso_timestamp(session.date, values.get("SessionTime")),
            "x": json_value(values.get("X")),
            "y": json_value(values.get("Y")),
            "z": json_value(values.get("Z")),
            "speed": json_value(values.get("Speed")),
            "throttle": json_value(values.get("Throttle")),
            "brake": json_value(values.get("Brake")),
            "gear": json_value(values.get("nGear")),
            "rpm": json_value(values.get("RPM")),
            "drs": json_value(values.get("DRS")),
        })
    return [sample for sample in samples if sample["date"] is not None]


def generate(args: argparse.Namespace) -> Path:
    cache_dir = Path(args.cache).resolve()
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    session = fastf1.get_session(args.year, args.event, args.session)
    session.load(telemetry=True, weather=False, messages=False)

    available = [str(number) for number in session.drivers]
    selected = args.drivers or available[: args.driver_limit]
    selected = [number for number in selected if number in available]
    if not selected:
        raise RuntimeError("None of the requested drivers are available in this session")

    replay = {
        "schemaVersion": 1,
        "source": "fastf1-generated-replay",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "session": {
            "year": args.year,
            "event": args.event,
            "name": args.session,
            "sessionKey": f"fastf1-{args.year}-{args.event}-{args.session}".lower().replace(" ", "-"),
            "meetingName": json_value(session.event.get("EventName")),
            "circuitName": json_value(session.event.get("Location")),
            "dateStart": session.date.astimezone(timezone.utc).isoformat(),
        },
        "driversByNumber": {
            number: driver_metadata(session, number) for number in selected
        },
        "samplesByDriver": {
            number: build_driver_samples(session, number) for number in selected
        },
    }

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    slug = f"{args.year}-{args.event}-{args.session}".lower().replace(" ", "-")
    output = output_dir / f"{slug}.json"
    output.write_text(json.dumps(replay, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("year", type=int)
    parser.add_argument("event", help="Round number or event name, e.g. 5 or Monaco")
    parser.add_argument("session", nargs="?", default="R", help="FastF1 session code (default: R)")
    parser.add_argument("--drivers", nargs="*", help="Driver numbers to include")
    parser.add_argument("--driver-limit", type=int, default=20)
    parser.add_argument("--cache", default=str(DEFAULT_CACHE_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()
    if str(args.event).isdigit():
        args.event = int(args.event)
    return args


if __name__ == "__main__":
    output_path = generate(parse_args())
    print(output_path)

