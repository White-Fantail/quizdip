import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { resolveLocale, localizeHref } from "../src/i18n/core";
import { t } from "../src/i18n/messages";
import { LocaleProvider } from "../src/i18n/provider";
import LanguageSwitcher from "../src/i18n/language-switcher";
import {getAdsConfig,publisherId} from "../src/lib/ads/config";
import {AdProvider} from "../src/components/ads/AdProvider";
import "./globals.css";
import "./management.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get("x-quizdip-locale"));
  const description = t(locale, "meta.description");
  const title = locale === "ko" ? "QuizDip — 단서를 따라, 재미를 발견해" : "QuizDip — Follow the clues. Find the fun.";
  return {
    title, applicationName: "QuizDip",
    keywords: ["QuizDip", "quiz", "quiz pack", "quiz creator", "퀴즈", "퀴즈팩"],
    description,
    ...(publisherId(process.env.ADSENSE_CLIENT_ID)?{other:{"google-adsense-account":publisherId(process.env.ADSENSE_CLIENT_ID)}}:{}),
    openGraph: { title, description, siteName: "QuizDip", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

const navLinks = [
  { href: "/discover", key: "nav.discover" },
  { href: "/play", key: "nav.play" },
  { href: "/leaderboard", key: "nav.leaderboard" },
  { href: "/studio", key: "nav.studio" },
  { href: "/account", key: "nav.account" },
] as const;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get("x-quizdip-locale"));
  const lockedLegacyBrowser = requestHeaders.get("x-quizdip-legacy-lock") === "locked";
  const adsConfig=getAdsConfig();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <AdProvider config={adsConfig}>
          {lockedLegacyBrowser ? <main>{children}</main> : <>
          <header className="site-header">
            <div className="container header-inner">
              <Link href={localizeHref("/", locale)} className="wordmark" aria-label={t(locale, "nav.home")}>QuizDip<span className="wordmark-dot">.</span></Link>
              <nav aria-label={locale === "ko" ? "주요 메뉴" : "Main navigation"} className="nav">
                {navLinks.map(({ href, key }) => (
                  <Link key={href} href={localizeHref(href, locale)}>{t(locale, key)}</Link>
                ))}
              </nav>
              <LanguageSwitcher compact />
            </div>
          </header>
          <main>{children}</main>
          <footer className="site-footer"><div className="container">
            <span>© QuizDip · Create it. Play it. Share it.</span>
            {" · "}
            <Link href={localizeHref("/about", locale)}>{locale === "ko" ? "서비스 소개 및 콘텐츠 원칙" : "About & content standards"}</Link>
            {" · "}
            <Link href={localizeHref("/packs", locale)}>{locale === "ko" ? "공개 퀴즈팩" : "Quiz pack library"}</Link>
            {" · "}
            <Link href={localizeHref("/privacy", locale)}>{locale === "ko" ? "개인정보처리방침" : "Privacy"}</Link>
            {" · "}
            <Link href={localizeHref("/terms", locale)}>{locale === "ko" ? "이용 안내" : "Terms"}</Link>
            {" · "}
            <Link href={localizeHref("/contact", locale)}>{locale === "ko" ? "문의" : "Contact"}</Link>
          </div></footer>
          </>}
          </AdProvider>
        </LocaleProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
