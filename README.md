# CanvaKilla.com

An AI-powered X profile banner and profile-picture studio with Nano Banana and GPT Image 2 routed through OpenRouter.

Production: https://canvakilla.com

## Run

```bash
npm install
set -a && source ~/.luna/secrets/keys.env && set +a
npm run dev
```

Open the local URL from the terminal. Upload optional reference images, load your profile photo, choose Banner or Profile editing, pick a model, write the next edit, and export a clean PNG for X.

## Notes

- API keys stay on the server in `OPENROUTER_API_KEY`; image generation routes through OpenRouter only.
- OpenRouter powers the image models so spend can be capped from one provider key. There is no direct OpenAI client/provider fallback in this app.
- PostHog analytics are optional; set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to enable sanitized launch funnel events. Client analytics disables autocapture, exception capture, session recording, pageview/pageleave capture, and raw provider error messages.
- Link unfurls use `public/og-launch.png` and Next Metadata Open Graph/Twitter card tags.
- No login is required. Anonymous generation sessions are server-issued as signed, HttpOnly cookies.
- Set `CANVAKILLA_SESSION_SECRET` in production so session cookies are signed independently from provider keys.
- Default API limits are 4 generations per minute and 20 per hour per signed session, plus 8 per minute and 40 per hour per IP. A separate cost-weighted limiter makes pricier models burn more of the budget. Configure with `GENERATION_RATE_LIMIT_PER_MINUTE`, `GENERATION_RATE_LIMIT_PER_HOUR`, `GENERATION_IP_RATE_LIMIT_PER_MINUTE`, `GENERATION_IP_RATE_LIMIT_PER_HOUR`, `GENERATION_COST_LIMIT_PER_MINUTE`, `GENERATION_COST_LIMIT_PER_HOUR`, `GENERATION_IP_COST_LIMIT_PER_MINUTE`, and `GENERATION_IP_COST_LIMIT_PER_HOUR`.
- `MAX_ACTIVE_GENERATIONS` limits concurrent in-process generations. For heavier launches, move rate-limit and active-generation state to a shared store such as Redis or Vercel KV because in-memory limits are per server instance.
- Each uploaded reference is capped at 8MB in the browser and must be PNG, JPEG, or WebP; each generation request is compressed client-side and capped at 4MB of source images.
- Uploaded images are kept as a newest-first reference stack and are not automatically placed into the banner preview.
- Click a reference card to insert a stable `Reference R#` instruction into the prompt.
- Uploaded profile photos are shown in the X preview and can be iterated separately in Profile mode.
- The current workspace autosaves in the browser with IndexedDB, so uploaded references, profile photos, prompts, generated images, and history survive refreshes and dev-server hot reloads. Use the in-app "Clear all local data" control to remove that IndexedDB workspace from the browser.
- The preview can switch between a desktop X profile layout and a mobile X profile layout.
- The template marks the lower-left avatar quiet zone, lower-right mobile action quiet zone, and crop guards.
- The export canvas crops generated output to X's recommended 1500x500 header size.
- Profile export creates a square 1024x1024 PNG with an optional circular-crop proof.
- The template overlay is only a preview guide unless you choose the proof export.
