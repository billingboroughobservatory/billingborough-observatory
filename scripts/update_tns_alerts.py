#!/usr/bin/env python3

"""
Update the Billingborough Observatory TNS alert data.

This collector runs locally on the Ubuntu Observatory development
machine because the TNS hourly public-object feed is accessible
from this machine but returns HTTP 403 to GitHub Actions runners.

Normal operation:
- downloads only the current TNS hourly public-object CSV;
- merges new and updated objects into the existing JSON cache;
- removes records whose last modification is more than 24 hours old;
- retains the newest 30 qualifying objects;
- refuses to overwrite the JSON if the TNS download fails.

The initial cache is supplied separately by the bootstrap process.
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


# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[1]

OUTPUT_FILE = (
    REPO_ROOT
    / "data"
    / "tns-alerts.json"
)

TNS_BASE_URL = (
    "https://www.wis-tns.org/system/files/tns_public_objects/"
)

TNS_OBJECT_URL = (
    "https://www.wis-tns.org/object/"
)

TNS_USER_AGENT = (
    'tns_marker{"tns_id":4565,"type": "user","name":"minnican"}'
)

HEADERS = {
    "User-Agent": TNS_USER_AGENT,
}

REQUEST_TIMEOUT = 60

MAX_ALERTS = 30

ROLLING_HOURS = 24


# ----------------------------------------------------------------------
# Time helpers
# ----------------------------------------------------------------------

def utc_now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


def parse_tns_datetime(
    value: str,
) -> datetime | None:
    """
    Parse a TNS timestamp.

    TNS timestamps are normally:

        2026-09-09 07:57:41

    Some fields include fractional seconds.
    """

    if not value:
        return None

    value = value.strip()

    formats = (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    )

    for fmt in formats:

        try:

            return datetime.strptime(
                value,
                fmt,
            ).replace(
                tzinfo=timezone.utc
            )

        except ValueError:
            pass

    return None


# ----------------------------------------------------------------------
# Download the current hourly TNS file
# ----------------------------------------------------------------------

def download_current_hour(
    hour: int,
) -> list[dict]:
    """
    Download and parse the TNS hourly public-object CSV.
    """

    filename = (
        f"tns_public_objects_{hour:02d}.csv.zip"
    )

    url = TNS_BASE_URL + filename

    print(
        f"Fetching hour {hour:02d}: {url}"
    )

    response = requests.post(
        url,
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT,
    )

    response.raise_for_status()

    with zipfile.ZipFile(
        io.BytesIO(response.content)
    ) as archive:

        csv_names = [
            name
            for name in archive.namelist()
            if name.lower().endswith(".csv")
        ]

        if not csv_names:

            raise RuntimeError(
                f"No CSV file found inside {filename}"
            )

        csv_name = csv_names[0]

        with archive.open(csv_name) as csv_file:

            text = io.TextIOWrapper(
                csv_file,
                encoding="utf-8-sig",
                newline="",
            )

            reader = csv.reader(text)

            # First line is the reporting period.
            try:
                next(reader)
            except StopIteration:
                return []

            # Second line contains the headers.
            try:
                headers = next(reader)
            except StopIteration:
                return []

            records = []

            for row in reader:

                if not row:
                    continue

                if len(row) != len(headers):
                    continue

                records.append(
                    dict(
                        zip(
                            headers,
                            row,
                        )
                    )
                )

    print(
        f"  Hour {hour:02d}: "
        f"{len(records)} raw records"
    )

    return records


# ----------------------------------------------------------------------
# Convert TNS record
# ----------------------------------------------------------------------

def convert_record(
    record: dict,
) -> dict | None:
    """
    Convert a TNS public-object record into the
    smaller structure used by the Observatory website.
    """

    objid = record.get(
        "objid",
        "",
    ).strip()

    name_prefix = record.get(
        "name_prefix",
        "",
    ).strip()

    name = record.get(
        "name",
        "",
    ).strip()

    classification = record.get(
        "type",
        "",
    ).strip()

    discovery_date = record.get(
        "discoverydate",
        "",
    ).strip()

    time_received = record.get(
        "time_received",
        "",
    ).strip()

    lastmodified = record.get(
        "lastmodified",
        "",
    ).strip()

    reporting_group = record.get(
        "reporting_group",
        "",
    ).strip()

    if not objid or not name:
        return None

    # Keep Astronomical Transients and Supernovae.
    if name_prefix not in (
        "AT",
        "SN",
    ):
        return None

    last_modified_dt = parse_tns_datetime(
        lastmodified
    )

    if last_modified_dt is None:
        return None

    received_dt = parse_tns_datetime(
        time_received
    )

    full_name = (
        f"{name_prefix} {name}"
    )

    return {
        "name": full_name,
        "url": (
            TNS_OBJECT_URL
            + name
        ),
        "objectId": objid,
        "received": time_received,
        "receivedTimestamp": (
            received_dt.isoformat()
            if received_dt
            else ""
        ),
        "objectType": name_prefix,
        "classification": classification,
        "discoveryDate": discovery_date,
        "lastModified": lastmodified,
        "reportingGroup": reporting_group,
    }


# ----------------------------------------------------------------------
# Load existing JSON
# ----------------------------------------------------------------------

def load_existing_data() -> dict:
    """
    Load the existing JSON cache.

    A missing file is treated as an empty cache.
    """

    if not OUTPUT_FILE.exists():

        print(
            "No existing TNS alert file found."
        )

        return {
            "cacheAvailable": False,
            "alerts": [],
        }

    try:

        with OUTPUT_FILE.open(
            "r",
            encoding="utf-8",
        ) as handle:

            data = json.load(handle)

        alerts = data.get(
            "alerts",
            [],
        )

        if not isinstance(
            alerts,
            list,
        ):

            raise ValueError(
                "alerts is not a list"
            )

        print(
            f"Existing alerts loaded: "
            f"{len(alerts)}"
        )

        return {
            "cacheAvailable": True,
            "alerts": alerts,
        }

    except Exception as exc:

        print(
            f"Could not read existing TNS data: "
            f"{exc}"
        )

        return {
            "cacheAvailable": False,
            "alerts": [],
        }


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

def main() -> int:

    now = utc_now()

    cutoff = (
        now
        - timedelta(
            hours=ROLLING_HOURS
        )
    )

    print(
        f"Current UTC time: "
        f"{now.isoformat()}"
    )

    print(
        f"24-hour cutoff: "
        f"{cutoff.isoformat()}"
    )

    existing_data = (
        load_existing_data()
    )

    existing_alerts = (
        existing_data["alerts"]
    )

    cache_available = (
        existing_data["cacheAvailable"]
    )

    records_by_id: dict[str, dict] = {}

    # --------------------------------------------------------------
    # Retain existing records that are still inside the rolling
    # 24-hour window.
    # --------------------------------------------------------------

    for alert in existing_alerts:

        timestamp = (
            alert.get(
                "lastModified",
                "",
            )
            or alert.get(
                "received",
                "",
            )
        )

        alert_dt = parse_tns_datetime(
            timestamp
        )

        object_id = str(
            alert.get(
                "objectId",
                "",
            )
        )

        if (
            object_id
            and alert_dt
            and alert_dt >= cutoff
        ):

            records_by_id[
                object_id
            ] = alert

    print(
        f"Existing alerts retained: "
        f"{len(records_by_id)}"
    )

    # --------------------------------------------------------------
    # Fetch the current TNS hourly file.
    # --------------------------------------------------------------

    current_hour = now.hour

    try:

        raw_records = (
            download_current_hour(
                current_hour
            )
        )

    except Exception as exc:

        print(
            f"ERROR: TNS download failed: "
            f"{exc}",
            file=sys.stderr,
        )

        print(
            "Existing TNS alert data "
            "will not be changed."
        )

        return 1

    # --------------------------------------------------------------
    # Merge current-hour records.
    # --------------------------------------------------------------

    qualifying_records = 0

    for raw_record in raw_records:

        alert = convert_record(
            raw_record
        )

        if alert is None:
            continue

        last_modified_dt = (
            parse_tns_datetime(
                alert[
                    "lastModified"
                ]
            )
        )

        if (
            last_modified_dt is None
            or last_modified_dt < cutoff
        ):
            continue

        qualifying_records += 1

        object_id = (
            alert["objectId"]
        )

        existing_alert = (
            records_by_id.get(
                object_id
            )
        )

        if existing_alert is None:

            records_by_id[
                object_id
            ] = alert

            continue

        existing_dt = (
            parse_tns_datetime(
                existing_alert.get(
                    "lastModified",
                    "",
                )
            )
        )

        if (
            existing_dt is None
            or last_modified_dt > existing_dt
        ):

            records_by_id[
                object_id
            ] = alert

    print(
        f"Qualifying records in current hour: "
        f"{qualifying_records}"
    )

    print(
        f"Unique alerts in rolling cache: "
        f"{len(records_by_id)}"
    )

    # --------------------------------------------------------------
    # Sort newest first and retain the latest 30.
    # --------------------------------------------------------------

    alerts = list(
        records_by_id.values()
    )

    alerts.sort(
        key=lambda alert: (
            parse_tns_datetime(
                alert.get(
                    "lastModified",
                    "",
                )
            )
            or datetime.min.replace(
                tzinfo=timezone.utc
            )
        ),
        reverse=True,
    )

    alerts = alerts[
        :MAX_ALERTS
    ]

    print(
        f"Final TNS alert count: "
        f"{len(alerts)}"
    )

    # --------------------------------------------------------------
    # Prepare output.
    # --------------------------------------------------------------

    output_data = {
        "generated": now.isoformat(),
        "source": (
            "TNS hourly public-object feed "
            "(rolling 24 hours)"
        ),
        "count": len(alerts),
        "alerts": alerts,
    }

    old_output = {}

    if OUTPUT_FILE.exists():

        try:

            with OUTPUT_FILE.open(
                "r",
                encoding="utf-8",
            ) as handle:

                old_output = json.load(
                    handle
                )

        except Exception:
            old_output = {}

    old_content = {
        "source": old_output.get(
            "source"
        ),
        "count": old_output.get(
            "count"
        ),
        "alerts": old_output.get(
            "alerts"
        ),
    }

    new_content = {
        "source": output_data[
            "source"
        ],
        "count": output_data[
            "count"
        ],
        "alerts": output_data[
            "alerts"
        ],
    }

    if new_content == old_content:

        print(
            "TNS alert data unchanged. "
            "No file update required."
        )

        return 0

    # --------------------------------------------------------------
    # Atomic JSON replacement.
    # --------------------------------------------------------------

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = (
        OUTPUT_FILE.with_suffix(
            ".json.tmp"
        )
    )

    with temporary_file.open(
        "w",
        encoding="utf-8",
    ) as handle:

        json.dump(
            output_data,
            handle,
            indent=2,
            ensure_ascii=False,
        )

        handle.write("\n")

    os.replace(
        temporary_file,
        OUTPUT_FILE,
    )

    print(
        f"Wrote {OUTPUT_FILE}"
    )

    return 0


if __name__ == "__main__":

    try:

        sys.exit(
            main()
        )

    except Exception as exc:

        print(
            f"ERROR: {exc}",
            file=sys.stderr,
        )

        sys.exit(1)
