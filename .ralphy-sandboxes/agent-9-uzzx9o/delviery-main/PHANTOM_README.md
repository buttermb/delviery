# PHANTOM v5.4 "PERFECTED" - User Manual

## 🎮 What is Phantom?

Phantom is an ultra-humanized burst fire macro for **Logitech G Hub** designed for **Arc Raiders**. It uses advanced anti-detection algorithms including:

- Biometric Rhythm Simulation (heartbeat, breathing)
- Chaos Engine (Lorenz Attractor math)
- Markov Mind States (simulated focus/distraction)
- Pink Noise Injection (defeats spectral analysis)
- Pattern Breaker (prevents repetitive sequences)

---

## 📦 Installation

### Step 1: Install Logitech G Hub
Download from: https://www.logitechg.com/en-us/innovation/g-hub.html

### Step 2: Open G Hub Scripting
1. Open **Logitech G Hub**
2. Click your mouse (e.g., G502)
3. Click the **Scripting** icon (top area)
4. Click **Create New Lua Script**

### Step 3: Activate Your License
1. Paste the script contents
2. **Replace `YOUR-KEY-HERE`** with your license key
3. Press **Ctrl+S** to save
4. Script will validate and run

---

## 🎯 Controls

### Fire Modes
| Button | Mode | Description |
|--------|------|-------------|
| Scroll Left | **BURST** | Standard burst fire (default) |
| Scroll Right | **SPRAY** | Hold for continuous fire |
| Middle Click | **TAP** | Single precise shots |

### Weapon Profiles
| Button | Weapon |
|--------|--------|
| Back | Viper (AR) |
| Forward | Stitcher (SMG) |
| **Shift+Back** | Tempest (AR) |
| **Shift+Forward** | Bobcat (SMG) |
| **Shift+Middle** | Ferro (BR) |
| **Shift+DPI** | Burletta (Pistol) |
| **Shift+ScrollL** | LMG |
| **Shift+ScrollR** | OFF |

### Other Controls
| Control | Action |
|---------|--------|
| DPI Button | Toggle Hipfire Mode |
| Caps Lock ON | Disable script (safety) |
| Caps Lock OFF | Enable script |

### How to Fire
1. Hold **Right Mouse Button** (aim)
2. Wait 200ms (or toggle Hipfire to skip)
3. Click **Left Mouse Button**
4. Burst fires automatically!

---

## ❓ FAQ

### Q: Script not working?
**A:** Check if Caps Lock is OFF. Caps Lock ON disables the script.

### Q: Gun shooting too slow?
**A:** Switch to Stitcher or Bobcat profile (Forward button or Shift+Forward).

### Q: Gun kicking too much?
**A:** Switch to Viper or Tempest profile (Back button or Shift+Back).

### Q: What does "Pattern detected" mean?
**A:** The script noticed you fired 3 identical bursts in a row. It's forcing variation to avoid detection.

### Q: Can I adjust timing?
**A:** Yes! Edit the `pools` section in the weapon profiles. Change `bMin` and `bMax` values.

### Q: Is this detectable?
**A:** Phantom uses 15+ humanization layers to mimic human input. No macro is 100% undetectable, but this is as close as possible.

### Q: My Shift key doesn't work for quick-swap?
**A:** If using a non-Logitech keyboard, try holding Shift before pressing the mouse button. Some keyboards have slight delay.

---

## 🔑 License Activation

Your script requires a valid license key to function.

**Key Format:** `PHANTOM-XXXX-XXXX-XXXX`

To activate:
1. Open the script in G Hub
2. Find the line: `local LICENSE_KEY = "YOUR-KEY-HERE"`
3. Replace with your key: `local LICENSE_KEY = "PHANTOM-A1B2-C3D4-E5F6"`
4. Save and run

---

## 🛡️ Anti-Detection Systems

| System | What It Does |
|--------|--------------|
| Chaos Engine | Lorenz Attractor for non-random variance |
| Pink Noise | Defeats FFT spectral analysis |
| Markov Mind | Random focus/distraction states |
| Session Randomizer | All timings shift ±10% per load |
| Dead Zone | 0.5% chance to "miss" clicks |
| Micro-Stutter | Simulates FPS lag pauses |
| Pattern Breaker | Prevents identical burst sequences |
| Neuro-Motor | Simulates nerve signal delays |

| Circadian | Session fatigue over time |
| Adrenaline | Combat intensity effects |

---

## 📞 Support

For issues or questions, contact the provider of your license key.

---

**Version:** 5.4 "Perfected"  
**Platform:** Logitech G Hub  
**Game:** Arc Raiders
