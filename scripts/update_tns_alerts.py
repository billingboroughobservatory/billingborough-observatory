#!/usr/bin/env python3

"""
Update the Billingborough Observatory TNS alert data.
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILE = REPO_ROOT / "data" / "tns-alerts.json"
TNS_BASE_URL = "https://www.wis-tns.org/system/files/tns_public_objects/"
TNS_OBJECT_URL = "https://www.wis-tns.org/object/"
TNS_USER_AGENT = 'tns_marker{"tns_id":4565,"type": "user","name":"minnican"}'
HEADERS = {"User-Agent": TNS_USER_AGENT}
REQUEST_TIMEOUT = 60
MAX_ALERTS = 30
ROLLING_HOURS = 24


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_tns_datetime(value: str) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def download_hour(hour: int) -> list[dict]:
    filename = f"tns_public_objects_{hour:02d}.csv.zip"
    url = TNS_BASE_URL + filename
    print(f"Fetching hour {hour:02d}: {url}")

    response = requests.post(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        csv_names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError(f"No CSV file found inside {filename}")

        with archive.open(csv_names[0]) as csv_file:
            text = io.TextIOWrapper(csv_file, encoding="utf-8-sig", newline="")
            reader = csv.reader(text)
            try:
                next(reader)
            except StopIteration:
                return []
            try:
                headers = next(reader)
            except StopIteration:
                return []

            records = [dict(zip(headers, row)) for row in reader if row and len(row) == len(headers)]

    print(f"  Hour {hour:02d}: {len(records)} raw records")
    return records


def download_current_hour_with_fallback(now_hour: int) -> tuple[list[dict], int]:
    """Try current hour; if unavailable, fall back to the previous hour."""
    try:
        return download_hour(now_hour), now_hour
    except requests.exceptions.HTTPError as exc:
        if exc.response is not None and exc.response.status_code in (403, 404):
            prev_hour = (now_hour - 1) % 24
            print(f"Current hour {now_hour:02d} unavailable ({exc.response.status_code}); falling back to hour {prev_hour:02d}.")
            return download_hour(prev_hour), prev_hour
        raise


def convert_record(record: dict) -> dict | None:
    objid = record.get("objid", "").strip()
    name_prefix = record.get("name_prefix", "").strip()
    name = record.get("name", "").strip()
    classification = record.get("type", "").strip()
    discovery_date = record.get("discoverydate", "").strip()
    discovery_mag = record.get("discoverymag", "").strip()
    discovery_mag_filter = record.get("discmagfilter", "").strip()
    time_received = record.get("time_received", "").strip()
    lastmodified = record.get("lastmodified", "").strip()
    reporting_group = record.get("reporting_group", "").strip()

    if not objid or not name or name_prefix not in ("AT", "SN"):
        return None

    last_modified_dt = parse_tns_datetime(lastmodified)
    if last_modified_dt is None:
        return None

    received_dt = parse_tns_datetime(time_received)

    return {
        "name": f"{name_prefix} {name}",
        "url": TNS_OBJECT_URL + name,
        "objectId": objid,
        "received": time_received,
        "receivedTimestamp": received_dt.isoformat() if received_dt else "",
        "objectType": name_prefix,
        "classification": classification,
        "discoveryDate": discovery_date,
        "discoveryMag": discovery_mag,
        "discoveryMagFilter": discovery_mag_filter,
        "lastModified": lastmodified,
        "reportingGroup": reporting_group,
    }


def load_existing_data() -> dict:
    if not OUTPUT_FILE.exists():
        return {"cacheAvailable": False, "alerts": []}
    try:
        with OUTPUT_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        alerts = data.get("alerts", [])
        return {"cacheAvailable": True, "alerts": alerts if isinstance(alerts, list) else []}
    except Exception:
        return {"cacheAvailable": False, "alerts": []}


def main() -> int:
    now = utc_now()
    cutoff = now - timedelta(hours=ROLLING_HOURS)
    existing_data = load_existing_data()
    records_by_id = {}

    for alert in existing_data["alerts"]:
        timestamp = alert.get("lastModified", "") or alert.get("received", "")
        alert_dt = parse_tns_datetime(timestamp)
        object_id = str(alert.get("objectId", ""))
        if object_id and alert_dt and alert_dt >= cutoff:
            records_by_id[object_id] = alert

    try:
        raw_records, _ = download_current_hour_with_fallback(now.hour)
    except Exception as exc:
        print(f"ERROR: TNS download failed: {exc}", file=sys.stderr)
        return 1

    for raw_record in raw_records:
        alert = convert_record(raw_record)
        if alert is None:
            continue
        last_modified_dt = parse_tns_datetime(alert["lastModified"])
        if last_modified_dt is None or last_modified_dt < cutoff:
            continue

        object_id = alert["objectId"]
        existing_alert = records_by_id.get(object_id)
        if existing_alert is None:
            records_by_id[object_id] = alert
            continue

        existing_dt = parse_tns_datetime(existing_alert.get("lastModified", ""))
        if existing_dt is None or last_modified_dt > existing_dt:
            records_by_id[object_id] = alert

    alerts = list(records_by_id.values())
    alerts.sort(
        key=lambda a: parse_tns_datetime(a.get("lastModified", "")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    alerts = alerts[:MAX_ALERTS]

    output_data = {
        "generated": now.isoformat(),
        "source": "TNS hourly public-object feed (rolling 24 hours)",
        "count": len(alerts),
        "alerts": alerts,
    }

    old_output = {}
    if OUTPUT_FILE.exists():
        try:
            with OUTPUT_FILE.open("r", encoding="utf-8") as handle:
                old_output = json.load(handle)
        except Exception:
            old_output = {}

    if {"source": old_output.get("source"), "count": old_output.get("count"), "alerts": old_output.get("alerts")} == {
        "source": output_data["source"],
        "count": output_data["count"],
        "alerts": output_data["alerts"],
    }:
        print("TNS alert data unchanged. No file update required.")
        return 0

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = OUTPUT_FILE.with_suffix(".json.tmp")
    with temporary_file.open("w", encoding="utf-8") as handle:
        json.dump(output_data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    os.replace(temporary_file, OUTPUT_FILE)
    print(f"Wrote {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)