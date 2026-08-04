import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HomeBackground } from "@/components/home-background";
import { SiteVisitBeacon } from "@/components/marketing/site-visit-beacon";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <HomeBackground />
      <SiteVisitBeacon />
      <Navbar />
      {/* Extra top pad so content clears the floating nav island */}
      <main className="container mx-auto flex max-w-7xl flex-grow flex-col px-4 pt-[4.75rem] sm:px-6 sm:pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
