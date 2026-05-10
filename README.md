<div align="center">

<img src="./public/og-image-v2.png" alt="CanvaKilla — the banner maker that knows where every platform actually crops" width="100%" />

# 🎨 CanvaKilla

**The banner maker that knows where every platform actually crops.**

Built because Canva kept hiding banner text behind avatars, mobile follow buttons, and the 60-pixel strips X clips off the top and bottom on certain displays.

[![Live](https://img.shields.io/badge/Live-canvakilla.com-22c55e)](https://canvakilla.com)
[![Built_in_public](https://img.shields.io/badge/Built_in_public_on-X-1da1f2?logo=x&logoColor=white)](https://x.com/joewilsonai)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org)
[![Vercel](https://img.shields.io/badge/Hosted-Vercel-000000?logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

[**🔗 Try it live →**](https://canvakilla.com)

</div>

---

## Why this exists

Canva's banner templates don't know where X (Twitter) crops your design.

- **Avatar circle** overlaps the lower-left of the banner — anything important there gets covered
- **Mobile Follow / Edit profile / Message buttons** sit on top of the lower-right
- **X clips ~60 pixels off the top and bottom** on certain display sizes

Every banner template you load in Canva ignores all three. Your text ends up under your face. Your logo gets buried under a Follow button. Your tagline disappears behind an iPhone notch.

**CanvaKilla bakes those crop guards into every prompt** so the AI image model places content where it will actually be visible.

## How it works

CanvaKilla is a Next.js app that talks to image-generation models through OpenRouter (so spending stays capped on a single API key). Every system prompt includes:

| Guard | What it does |
|---|---|
| **Avatar quiet zone** | Keep faces, logos, and text out of the lower-left 34% × 46% |
| **Mobile-action overlay** | Keep the lower-right 200 × 100 px visually quiet for the Follow/Message buttons |
| **Edge crop strips** | No critical detail in the top 60 px / bottom 60 px |
| **3:1 aspect** | Final export at 1500 × 500 (X's banner dimensions) |

The result: a banner that looks intentional on desktop **and** mobile, with your face and tagline still visible after the avatar lands.

## Features

- 🖼️ **Reference-driven iteration** — upload reference images, label them `R1`, `R2`, etc., then iterate prompts that mention them by name
- 📐 **Two modes** — Banner (3:1 landscape) and Profile picture (1:1 square)
- 👁️ **Live X-preview canvas** — switches between desktop and mobile X layouts so you see the avatar circle, mobile-action overlay, and crop strips fall on your design in real time
- 🎨 **Multiple model providers** — GPT Image 2, Imagen 4 Ultra, Flux Pro, Seedream 4
- 💾 **One-click export** — properly sized for X's banner spec out of the box

## Quick start

```bash
git clone https://github.com/joewilsonai/canvakilla
cd canvakilla
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind**
- **OpenRouter** for image-generation provider routing
- **Vercel** for deploy

## License

MIT — fork it, kill more design tools.
