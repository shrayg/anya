import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-canvas relative flex min-h-screen flex-col">
      <Navbar />
      <main className="relative flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
