import Link from "next/link";
import { PLATFORM_CONFIGS, PLATFORM_IDS } from "../lib/platforms";

export default function Home() {
  return (
    <main className="platform-picker">
      <section className="platform-picker-inner" aria-labelledby="platform-picker-title">
        <img
          className="home-brand-logo"
          src="/logo.svg"
          alt=""
          aria-hidden="true"
        />
        <p className="eyebrow">Canva sucks, Introducing:</p>
        <h1 id="platform-picker-title">CanvaKilla.com</h1>
        <p className="platform-picker-tagline">
          canvakilla — banner maker that knows where every platform actually crops.
          because canva doesn&apos;t.
        </p>
        <div className="platform-picker-actions" aria-label="Choose a platform">
          {PLATFORM_IDS.map((platformId) => {
            const platform = PLATFORM_CONFIGS[platformId];
            return (
              <Link href={platform.route} key={platform.id}>
                <span>{platform.tabLabel}</span>
                <strong>{platform.quickStartKicker}</strong>
                <small>{platform.bannerSize.label}</small>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
