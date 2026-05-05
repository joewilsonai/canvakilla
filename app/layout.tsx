import type { Metadata } from "next";
import "./globals.css";
import { PostHogProvider } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://canvakilla.com";
const title =
  "CanvaKilla - banner maker that knows where every platform actually crops";
const description =
  "Crop guards, avatar zones, mobile overlays, and AI image iteration for X and LinkedIn banners and profile pictures.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description: "Crop math kills more banners than bad design. Free public preview.",
    url: siteUrl,
    siteName: "CanvaKilla.com",
    type: "website",
    images: [
      {
        url: "/og-image-v2.png",
        width: 1200,
        height: 630,
        alt: "CanvaKilla banner maker with platform crop guards.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: "Crop math kills more banners than bad design. Free public preview.",
    images: ["/og-image-v2.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
