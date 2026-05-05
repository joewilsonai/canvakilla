import type { Metadata } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://canvakilla.com";
const title = "CanvaKilla - banner maker that knows where X actually crops";
const description =
  "Crop guards, avatar zones, mobile button overlays, and AI image iteration for X banners and profile pictures.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description:
      "Crop math kills more banners than bad design. Free until the OpenRouter credits run out.",
    url: siteUrl,
    siteName: "CanvaKilla.com",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "CanvaKilla X banner maker with avatar and mobile crop guards.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description:
      "Crop math kills more banners than bad design. Free until the OpenRouter credits run out.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
