---
title: "Samsung Galaxy Battery Replacement (S22 / S23 / S24)"
device: "Samsung Galaxy S22 / S23 / S24 series"
difficulty: "Beginner"
estimatedTime: "30–45 minutes"
tools:
  - "SIM ejector pin"
  - "Heat gun or iOpener"
  - "Suction cup"
  - "Phillips #00 screwdriver"
  - "Plastic spudger set"
  - "Tweezers"
  - "B-7000 UV glue or pre-cut adhesive"
parts:
  - sku: "BAT-SS22-OEM"
    name: "Samsung Galaxy S22 Battery 3700 mAh"
  - sku: "BAT-SS23-OEM"
    name: "Samsung Galaxy S23 Battery 3900 mAh"
  - sku: "BAT-SS24-OEM"
    name: "Samsung Galaxy S24 Battery 4000 mAh"
warnings:
  - "Never puncture or bend the battery — lithium polymer fires are self-sustaining."
  - "Samsung uses pull-tab adhesive under the battery. Pull at a low angle (15°) to avoid tearing."
  - "Discharge battery below 25% before opening for maximum safety."
updatedAt: "2026-02-25"
author: "TechMo Workshop Team"
---

## Overview

Samsung Galaxy S-series phones use a back-glass construction. The rear glass panel must
be removed first to access the battery. Unlike iPhones, the back panel is easier to remove
than the front display.

---

## Step 1 — Safety Preparation

1. Charge the device down to **below 25%** and power it off.
2. Remove the SIM tray with the ejector pin.
3. **Do not skip this** — a fully charged lithium battery is a fire hazard if punctured.

---

## Step 2 — Soften Back Glass Adhesive

1. Apply heat around the **perimeter of the back glass** for 2 minutes (~65 °C).
   Focus on corners and edges.
2. Attach the suction cup near the **top centre** of the back glass.
3. Create a small gap and insert a plastic pick at the **top edge** (opposite the camera module side).
4. Slide the pick slowly around the perimeter. Re-apply heat as needed.
5. Lift the back glass off. Set aside.

> 💡 On S24, Samsung uses stronger adhesive — heat for an extra 60 seconds.

---

## Step 3 — Remove the Main Board Shield

1. Remove **all Phillips #00 screws** from the mid-frame (typically 12–14 screws on S22/S23).
2. Lift the plastic NFC coil cover and the wireless charging coil if present.
3. Disconnect the battery flex cable using a spudger — pop upward from the edge.

---

## Step 4 — Remove Old Battery

1. Look for the **pull-tab adhesive strip** along the bottom edge of the battery.
2. Fold the tab back and pull **slowly at 15–20°** while applying mild heat to the battery.
3. If the tab breaks, insert a plastic card behind the battery near the bottom edge and
   slowly slide up, using isopropyl alcohol on the adhesive if needed.
4. Lift the battery out without bending it.

---

## Step 5 — Install New Battery

1. Check the replacement battery: verify correct voltage (3.85 V), capacity, and connector type.
2. Apply the new pre-cut adhesive strips to the battery (or apply B-7000 sparingly).
3. Lower the battery into place — align connector to the top.
4. Press down firmly for 30 seconds.
5. Reconnect the battery flex cable — you should feel a distinct click.

---

## Step 6 — Test Before Resealing

1. Power on the device without closing the back panel.
2. Verify battery percentage appears and charging works (connect USB-C cable).
3. Run **Samsung Members → Diagnostics → Battery** to confirm battery health registers.
4. Check the battery registers with a **full capacity reading** in Samsung Members — not an estimated figure.

---

## Step 7 — Reseal Back Glass

1. Clean the frame adhesive channel with IPA on a cotton bud.
2. Apply new adhesive strips or B-7000 UV glue around the perimeter.
3. Press the back glass down firmly and clamp for 10 minutes (rubber band or book press).
4. Re-insert the SIM tray.
5. Power on and run a final diagnostics check.

---

## Battery Health Benchmarks

| Cycle Count | Expected Capacity | Action |
|---|---|---|
| 0–200 | > 95% | Normal |
| 200–400 | 90–95% | Monitor |
| 400–600 | 80–90% | Recommend replacement |
| 600+ | < 80% | Replace urgently |

> Use **Samsung Members → Battery** to check cycle count. TechMo staff can also run a
> battery load test using the USB serial tester on the workshop bench.

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Phone not powering on after swap | Battery connector not clicked | Reopen and reseat battery flex |
| Battery percentage stuck at 0% | Faulty replacement battery | Swap with another unit from stock |
| Rapid discharge after replacement | Uncalibrated new battery | Full charge + full discharge cycle x2 |
| Back glass not flush on one corner | Adhesive not cured | Clamp that corner for another 30 min |
| Wireless charging not working | NFC coil not reinstalled | Reopen and re-lay coil in channel |
