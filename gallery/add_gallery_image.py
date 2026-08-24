#!/usr/bin/env python3

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
import tkinter as tk
from tkinter import filedialog


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GALLERY_DIR = PROJECT_ROOT / "gallery"
JSON_FILE = GALLERY_DIR / "data" / "gallery.json"
IMAGE_ROOT = GALLERY_DIR / "images"

SERVER_ROOT = Path("/srv/billingborough-gallery")
SERVER_IMAGE_ROOT = SERVER_ROOT / "images"
SERVER_JSON_FILE = SERVER_ROOT / "data" / "gallery.json"


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def fail(message):
    print(f"\nERROR: {message}")
    sys.exit(1)


def choose(items, prompt):
    print()

    for number, item in enumerate(items, 1):
        print(f"{number}. {item['title']}")

    while True:
        try:
            choice = int(input(f"\n{prompt}: "))
            if 1 <= choice <= len(items):
                return items[choice - 1]
        except ValueError:
            pass

        print("Please enter a valid number.")


def run_command(command):
    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        fail("Command failed.")

    return result.stdout


def relative_image_path(path):
    return path.relative_to(IMAGE_ROOT).as_posix()


# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

if not JSON_FILE.exists():
    fail(f"Gallery JSON not found: {JSON_FILE}")

try:
    with JSON_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
except json.JSONDecodeError as e:
    fail(f"gallery.json is not valid JSON: {e}")


sections = data.get("sections", [])

if not sections:
    fail("No gallery sections found in gallery.json.")


# --------------------------------------------------
# COMMAND-LINE OPTIONS
# --------------------------------------------------

parser = argparse.ArgumentParser(
    description="Add an image to the Billingborough Observatory gallery."
)

parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Show what would happen without changing or uploading anything."
)

args = parser.parse_args()


# --------------------------------------------------
# IMAGE
# --------------------------------------------------

print("\n==============================================")
print(" Billingborough Observatory — Add Image")
print("==============================================")


root = tk.Tk()
root.withdraw()

selected_file = filedialog.askopenfilename(
    title="Select image for Billingborough Observatory Gallery",
    filetypes=[
        ("Image files", "*.jpg *.jpeg *.png *.webp"),
        ("JPEG images", "*.jpg *.jpeg"),
        ("PNG images", "*.png"),
        ("WebP images", "*.webp"),
        ("All files", "*.*")
    ]
)

root.destroy()

if not selected_file:
    fail("No image selected.")

source = Path(selected_file)

if not source.exists():
    fail(f"Image file does not exist: {source}")

if not source.is_file():
    fail(f"Not a file: {source}")


allowed_extensions = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
}

if source.suffix.lower() not in allowed_extensions:
    fail(
        "Unsupported image type. "
        "Use JPG, JPEG, PNG or WebP."
    )


# --------------------------------------------------
# SECTION
# --------------------------------------------------

section = choose(
    sections,
    "Choose a section"
)


# --------------------------------------------------
# CATEGORY
# --------------------------------------------------

categories = section.get("categories", [])

if not categories:
    fail(
        f"No categories are defined for "
        f"{section['title']}."
    )

category = choose(
    categories,
    "Choose a category"
)


# --------------------------------------------------
# SUBCATEGORY
# --------------------------------------------------

children = category.get("children", [])

subcategory = None

if children:

    subcategory = choose(
        children,
        "Choose a subject"
    )


# --------------------------------------------------
# METADATA
# --------------------------------------------------

print()

title = input("Title: ").strip()

if not title:
    fail("A title is required.")


description = input("Description: ").strip()

if not description:
    fail("A description is required.")


date = input("Date [2026]: ").strip()

if not date:
    date = "2026"


# --------------------------------------------------
# DESTINATION
# --------------------------------------------------

destination_parts = [
    section["title"],
    category["title"]
]

if subcategory:
    destination_parts.append(subcategory["title"])


# Convert the actual hierarchy titles to the
# existing directory naming convention.

directory_map = {
    "The Boundary Layer": "01_The_Boundary_Layer",
    "The Solar System": "02_The_Solar_System",
    "Deep Space": "03_Deep_Space",

    "Atmospheric Optics": "Atmospheric_Optics",
    "Aurora Borealis": "Aurora_Borealis",
    "Human Spaceflight": "Human_Spaceflight",
    "Meteors & Fireballs": "Meteors_and_Fireballs",

    "Asteroids": "Asteroids",
    "Comets": "Comets",
    "The Moon": "The_Moon",
    "The Sun": "The_Sun",
    "The Planets": "The_Planets",

    "Galaxies": "Galaxies",
    "Star Clusters": "Star_Clusters",
    "Stellar Graveyards": "Stellar_Graveyards",
    "Stellar Nurseries": "Stellar_Nurseries",

    "Mercury": "01_Mercury",
    "Venus": "02_Venus",
    "Mars": "03_Mars",
    "Jupiter": "04_Jupiter",
    "Saturn": "05_Saturn",
    "Uranus": "06_Uranus",
    "Neptune": "07_Neptune",
}


directory_parts = [
    directory_map.get(part, part.replace(" ", "_"))
    for part in destination_parts
]

destination_directory = IMAGE_ROOT.joinpath(
    *directory_parts
)

destination_directory.mkdir(
    parents=True,
    exist_ok=True
)

destination_file = (
    destination_directory /
    source.name
)

relative_path = relative_image_path(
    destination_file
)


# --------------------------------------------------
# CHECK FOR DUPLICATES
# --------------------------------------------------

if destination_file.exists():
    fail(
        f"An image with this filename already exists:\n"
        f"{destination_file}"
    )


for existing in data.get("images", []):

    if existing.get("image") == relative_path:

        fail(
            "This image path is already present "
            "in gallery.json."
        )


# --------------------------------------------------
# BUILD GALLERY ENTRY
# --------------------------------------------------

entry = {
    "image": relative_path,
    "thumbnail": relative_path,
    "title": title,
    "description": description,
    "date": date,
    "section": section["id"],
    "category": category["id"]
}

if subcategory:
    entry["subcategory"] = subcategory["id"]


# --------------------------------------------------
# SHOW SUMMARY
# --------------------------------------------------

print("\n----------------------------------------------")
print("Gallery entry")
print("----------------------------------------------")
print(f"Image:       {relative_path}")
print(f"Section:     {section['title']}")
print(f"Category:    {category['title']}")

if subcategory:
    print(f"Subject:     {subcategory['title']}")

print(f"Title:       {title}")
print(f"Description: {description}")
print(f"Date:        {date}")
print("----------------------------------------------")

if args.dry_run:
    print("\nDRY RUN — no files have been changed.")
    sys.exit(0)


confirmation = input(
    "\nAdd this image and publish it? [y/N]: "
).strip().lower()

if confirmation not in {"y", "yes"}:
    print("\nCancelled. No changes made.")
    sys.exit(0)


# --------------------------------------------------
# COPY IMAGE
# --------------------------------------------------

print("\nCopying image...")

shutil.copy2(
    source,
    destination_file
)


# --------------------------------------------------
# UPDATE JSON
# --------------------------------------------------

print("Updating gallery.json...")

data.setdefault("images", []).append(entry)

with JSON_FILE.open("w", encoding="utf-8") as f:
    json.dump(
        data,
        f,
        indent=2,
        ensure_ascii=False
    )
    f.write("\n")


# --------------------------------------------------
# VALIDATE JSON
# --------------------------------------------------

try:
    with JSON_FILE.open(encoding="utf-8") as f:
        json.load(f)
except json.JSONDecodeError as e:

    destination_file.unlink(missing_ok=True)

    fail(
        f"gallery.json became invalid: {e}"
    )


print("JSON OK.")


# --------------------------------------------------
# RSYNC IMAGE
# --------------------------------------------------

print("\nUploading image to server...")

run_command([
    "sudo",
    "rsync",
    "-avh",
    f"{destination_file}",
    f"{SERVER_IMAGE_ROOT}/{destination_file.relative_to(IMAGE_ROOT).parent}/"
])


# --------------------------------------------------
# RSYNC JSON
# --------------------------------------------------

print("\nUploading gallery.json...")

run_command([
    "sudo",
    "rsync",
    "-avh",
    str(JSON_FILE),
    str(SERVER_JSON_FILE)
])


# --------------------------------------------------
# VERIFY
# --------------------------------------------------

print("\nVerifying server files...")

remote_image = (
    "https://gallery.billingboroughobservatory.space/"
    "images/"
    + relative_path
)

result = subprocess.run(
    [
        "curl",
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        remote_image
    ],
    capture_output=True,
    text=True
)

if result.stdout.strip() != "200":

    fail(
        f"Image was uploaded but returned HTTP "
        f"{result.stdout.strip()}"
    )


print(f"Image: HTTP {result.stdout.strip()}")

print("\nValidating remote gallery.json...")

result = subprocess.run(
    [
        "curl",
        "-s",
        "https://gallery.billingboroughobservatory.space/"
        "data/gallery.json"
    ],
    capture_output=True,
    text=True
)

try:
    json.loads(result.stdout)
except json.JSONDecodeError:
    fail("Remote gallery.json is not valid JSON.")


print("Remote JSON OK.")

print("\n==============================================")
print(" SUCCESS")
print("==============================================")
print(f"\nAdded: {title}")
print(f"Location: {relative_path}")
print("\nThe image is now live in the gallery.")
print("\nRemember to commit the changes to Git.")
