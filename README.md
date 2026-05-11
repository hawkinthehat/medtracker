### 1. HEADER & BRANDING

# 🛡️ Tiaki: Daily Guardian

**Subtitle:** A high-legibility, privacy-centric medical stabilizer for Dysautonomia and complex chronic conditions.

Tiaki is part of the **Longhouse Suite** — local-first digital tools built for clarity, ownership of data, and calmer daily workflows.

---

### 2. CORE FEATURES

- **Barometric Advisory System** — Predictive alerts for atmospheric pressure shifts (the “Human Barometer” fix), using forecast context so you can correlate symptoms with weather swings.

- **Orthostatic Vital Tracker** — Guided lying vs. standing BP/HR logging for clinical-grade POTS/OH documentation.

- **Silent Scientist** — Background metabolic pathway mapping (including CYP3A4 context) to highlight medication bottlenecks and interactions worth discussing with your prescriber.

- **Doctor Export** — Fast generation of clinical summaries for specialist appointments from what you already log.

---

### 3. DESIGN PHILOSOPHY (“THE JADE VIEW”)

Tiaki follows a **high contrast / high legibility** framework suited to brain fog and sensory overload:

- **Canvas:** White `#FFFFFF` background with primary text near `#0F172A` for crisp reading.

- **Touch targets:** Aim for **at least 60px** button height on primary actions so taps succeed on low-dexterity or high-fog days.

---

### 4. TECH STACK & SETUP

| Layer | Choice |
|-------|--------|
| Framework | **Next.js** (App Router) |
| Data | **Supabase** with Row Level Security (RLS) |
| Styling | **Tailwind CSS** |
| Weather | **OpenWeather** API |

**Required environment variables**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client) |
| `NEXT_PUBLIC_OPENWEATHER_API_KEY` | OpenWeather API key for forecasts |

Copy `.env.example` if present, or create `.env.local` with these keys before running `npm install` and `npm run dev`.

---

### 5. PRIVACY & LICENSE

**Privacy-first:** Your health data belongs to you. Tiaki is designed to work with **your own Supabase instance** so you control storage, access policies, and exports — not a shared multi-tenant silo by default.

License terms for this repository follow the license file in the project root (add or update `LICENSE` as appropriate for your distribution).
