import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import StudioShowcase from "@/components/StudioShowcase";
import NoBluff from "@/components/NoBluff";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* fixed background texture */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
      </div>

      {/* viewport frame — ink border on all 4 sides */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] border-2 border-line" />

      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <StudioShowcase />
        <NoBluff />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
