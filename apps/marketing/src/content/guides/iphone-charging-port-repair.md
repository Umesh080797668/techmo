---
title: "iPhone Charging Port Repair (iPhone 13 / 14 / 15)"
device: "iPhone 13, 14, 15 series"
difficulty: "Advanced"
estimatedTime: "60–90 minutes"
tools:
  - "Pentalobe P2 screwdriver"
  - "Tri-point Y000 screwdriver"
  - "Phillips #000 screwdriver"
  - "Heat gun or iOpener"
  - "Suction cup + metal picks"
  - "Tweezers (straight + curved)"
  - "Spudger"
  - "USB-C tester / multimeter"
parts:
  - sku: "CHRG-IP13-OEM"
    name: "iPhone 13 Lightning Charging Port Flex"
  - sku: "CHRG-IP14-OEM"
    name: "iPhone 14 Lightning Charging Port Flex"
  - sku: "CHRG-IP15-OEM"
    name: "iPhone 15 USB-C Charging Port Flex"
warnings:
  - "iPhone 15 is the first iPhone with USB-C — the port assembly is different from Lightning models."
  - "The charging port flex on iPhone 13/14/15 runs through the entire bottom of the device and connects the Taptic Engine, microphone, and antenna — take care not to damage these."
  - "On iPhone 15, Apple uses a USB-C controller IC — only genuine or MFi-certified USB-C ports support USB 3 speeds."
updatedAt: "2026-02-25"
author: "TechMo Workshop Team"
---

## Overview

The charging port flex on iPhone 13–15 is a long ribbon cable assembly that also carries
the Taptic Engine vibration motor, bottom microphone, and LTE/5G antenna signals.
This makes it one of the more involved cable replacements on modern iPhones.

> **iPhone 13 / 14:** Lightning connector
> **iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max:** USB-C connector

---

## Step 1 — Open the Device

Follow the first 3 steps of the iPhone screen replacement guide:

1. Remove Pentalobe screws.
2. Heat and open the display.
3. Disconnect the battery.

**Additionally:** Fully disconnect the display assembly and set it aside — you need unobstructed
access to the full length of the bottom chassis.

---

## Step 2 — Remove the Main Board

To access the full charging port assembly, the main board must be removed:

1. Remove all Y000 and Phillips screws from the board shield (mark positions with a magnetic mat).
2. Disconnect the following cables from the board (use a spudger, connectors pop up):
   - Display connectors (already disconnected in Step 1)
   - Front camera / Face ID module
   - Rear camera modules (2 or 3 connectors depending on model)
   - Battery connector
   - SIM card reader connector
3. Lift the board at a shallow angle — the board is also connected to the charging port flex below.
4. On iPhone 14: The board is split into two layers. Separate the board layers carefully.

---

## Step 3 — Remove the Charging Port Assembly

The charging port flex is secured with several small Phillips screws and connects to the
Taptic Engine and antenna:

1. Remove the **Taptic Engine** (2 Phillips screws) — the Taptic Engine is attached to the
   charging port assembly on iPhone 13/14.
2. Remove the **speaker** (2 Phillips screws) — also attached to the assembly.
3. Disconnect the **antenna cables** routed through the assembly.
4. Remove remaining screws along the bottom edge of the flex cable.
5. Carefully lift the entire charging port flex assembly out of the chassis.

---

## Step 4 — Diagnose Before Replacement

Before installing the new part, diagnose the original fault:

1. **Visual inspection:** Look for bent or broken Lightning/USB-C pins, lint packed in port,
   corrosion on connector contacts.
2. **Multimeter test:** Check continuity between VBUS pin and battery positive.
3. **USB-C tester:** Plug in a USB-C tester (PD-compatible) — it should show 5V.
4. **Lint removal:** Often the "charging fault" is lint packed in the port. Use a toothpick
   to carefully remove lint in circular scraping motions before replacing the port.

> 💡 **30% of charging port jobs are lint removal only.** Always inspect the port visually
> before ordering replacement parts.

---

## Step 5 — Install New Charging Port Assembly

1. Route the new flex cable into the chassis — follow the routing channel exactly.
2. Connect antenna cables first (they are the hardest to reach).
3. Re-install Taptic Engine and speaker onto the new assembly.
4. Secure all screws from bottom of chassis.

---

## Step 6 — Reassemble

1. Lower the main board back onto the chassis — ensure the charging port connector aligns.
2. Connect all board connectors in reverse order (battery last).
3. Re-install board shields and all screws.

---

## Step 7 — Test Before Sealing Display

1. Power on — verify boot.
2. Connect a Lightning/USB-C cable: charging indicator should appear immediately.
3. Test Taptic Engine: **Settings → Sounds & Haptics → Play** haptic pattern.
4. Test bottom microphone: record a voice memo and check audio quality.
5. On iPhone 15: test USB 3 data speeds by connecting to a Mac (expected: 10 Gbps with genuine port).

---

## Common Faults & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| No charging, no data | Broken port internals | Replace assembly |
| Charging intermittent | Bent pins | Replace assembly |
| "Accessory not supported" | Non-MFi cable or port IC | Use Apple cable; replace with genuine port |
| No vibration | Taptic Engine cable not reconnected | Reopen and reseat Taptic Engine |
| Bottom mic not working | Mic flex damaged during removal | Source new assembly with mic |
| USB-C only charges at 5W | Third-party USB-C controller | Replace with genuine Apple USB-C port |
