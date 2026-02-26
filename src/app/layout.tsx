import { ThemeProvider } from "@/components/theme-provider"
import { WalletProvider } from "@/context/wallet-context"
import { ThirdwebProvider } from "thirdweb/react"
import "./globals.css"
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "uWu - Pay with USDC",
  description: "Pay with USDC at any QR. P2P crypto trading made simple.",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThirdwebProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <WalletProvider>
              {children}
            </WalletProvider>
            <Analytics />
          </ThemeProvider>
        </ThirdwebProvider>
      </body>
    </html>
  )
}

