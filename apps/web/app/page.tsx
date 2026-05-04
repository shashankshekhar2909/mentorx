import { HeroSection }      from "@/components/home/hero-section";
import { StatsBar }         from "@/components/home/stats-bar";
import { HowItWorks }       from "@/components/home/how-it-works";
import { ExamCategories }   from "@/components/home/exam-categories";
import { FeaturedMentors }  from "@/components/home/featured-mentors";
import { Testimonials }     from "@/components/home/testimonials";
import { CTASection }       from "@/components/home/cta-section";
import { GraphCanvas }      from "@/components/home/graph-canvas";

/**
 * MentorX public homepage.
 *
 * The root layout no longer wraps in a max-width container, so each section
 * is truly full-bleed. The TopNav is fixed/sticky, so we add pt-16 to push
 * content below it.
 */
export default function HomePage() {
  return (
    <div className="w-full overflow-x-hidden" style={{ color: "#e2e8f0" }}>
      {/* Full-screen 3D graph — fixed, sits behind all page content */}
      <GraphCanvas />

      {/* Offset for the fixed navbar */}
      <div className="relative z-10 pt-16">
        <HeroSection />
        <StatsBar />
        <HowItWorks />
        <ExamCategories />
        <FeaturedMentors />
        <Testimonials />
        <CTASection />

        {/* Footer */}
        <footer
          className="w-full border-t px-6 py-10 text-center text-xs"
          style={{
            borderColor: "rgba(255,255,255,0.06)",
            color: "#475569",
            background: "#05070f",
          }}
        >
          <div className="mx-auto max-w-4xl">
            {/* Logo row */}
            <div className="mb-4 flex items-center justify-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black text-white"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                  boxShadow: "0 2px 12px rgba(124,58,237,0.4)",
                }}
              >
                MX
              </div>
              <span
                className="text-sm font-black"
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 60%, #34d399 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                MentorX
              </span>
            </div>
            <p className="mb-3 text-slate-600">
              India&apos;s #1 exam-prep mentorship platform. Built for serious aspirants.
            </p>
            <p>
              © {new Date().getFullYear()} mentorXAI &middot;{" "}
              <a href="/login" className="text-slate-500 transition hover:text-slate-300">
                Login
              </a>
              {" · "}
              <a href="/register" className="text-slate-500 transition hover:text-slate-300">
                Register
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
