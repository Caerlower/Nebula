# Nebula — scroll-driven landing page

A cinematic, scroll-scrubbed 3D story for Nebula: an MCP that gives AI agents a
Stellar wallet with automated yield, x402/MPP payments, and on-chain reputation.

**Stack:** Vite · React · TypeScript · Three.js (react-three-fiber + drei) ·
GSAP ScrollTrigger · Lenis · Tailwind v4. All 3D is procedural — primitives,
GLSL, instanced particles. No model files, no external assets.

> Part of the [Nebula monorepo](../../README.md) — built into the Hub's `public/landing` for deploy.

## Table of contents

- [Run it](#run-it)
- [How the scrub works](#how-the-scrub-works)
- [Where to edit each beat](#where-to-edit-each-beat)
- [Performance](#performance)
- [Waitlist](#waitlist)
- [Polish backlog (next passes)](#polish-backlog-next-passes)

## Run it

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # typecheck + production build
```

Requires Node 18+.

## How the scrub works

One pinned section (`StorySection`) spans 520% of scroll. A single
ScrollTrigger scrubs a master timeline that does two things:

1. Writes `STORY.progress` (0..1) every update → `StoryDriver` damps it into
   `STORY.smooth` inside the render loop → **every 3D object derives its state
   as a pure function of that value.** Scroll back and the story reverses
   frame-perfectly, including the particle burst.
2. Fades the DOM text overlays at each beat (timeline positions are in
   progress units, padded to exactly 1.0).

## Where to edit each beat

Beat timings live in `src/lib/story.ts` (`BEAT`). Everything else is modular:

| Beat | What | File |
| --- | --- | --- |
| — | Camera shot list | `src/scene/CameraRig.tsx` (`KEYS`) |
| 1 | Alley walls + light strips | `src/scene/AlleyWalls.tsx` |
| 1 | Bright agents passing the far street | `src/scene/BackgroundAgents.tsx` |
| 1–4 | The protagonist (pose, ignition, aura) | `src/scene/Agent.tsx` |
| 2–3 | The cloaked MCP figure + warm orb | `src/scene/Elder.tsx` |
| 3 | Burst: particles, shockwaves, flash | `src/scene/BurstFX.tsx` |
| 4 | The four power orbs | `src/scene/PowerOrbs.tsx` |
| all | Nebula fog shader (energy per beat) | `src/scene/NebulaBackdrop.tsx` |
| all | Text overlay timing | `src/ui/StorySection.tsx` |
| — | Bloom / vignette | `src/scene/Effects.tsx` |
| — | Mobile quality tiers | `src/lib/device.ts` |

## Performance

Capped DPR, instanced burst particles, one shared procedural glow texture,
quality tiers on mobile (fewer particles/stars, 3 noise octaves, no MSAA),
`prefers-reduced-motion` falls back to native scroll.

## Waitlist

Emails are stored in in-memory React state only (`WaitlistContext`) — resets
on refresh by design. Wire `submit()` to a backend when ready.

## Polish backlog (next passes)

- Beat 3: layered burst (spark streaks + secondary embers), chromatic pulse
- Beat 1: wall surface detail (panel lines shader), volumetric alley haze
- Camera: catmull-rom path + per-shot FOV shifts
- Agent: fresnel rim shader instead of flat emissive
- Beat 5: reflective floor (drei MeshReflectorMaterial, desktop only)
