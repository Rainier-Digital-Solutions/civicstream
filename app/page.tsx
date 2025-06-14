import { Hero } from '@/components/hero';
import { HowItWorks } from '@/components/how-it-works';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-grow mx-auto max-w-screen-xl">
        <Hero />
        <section className="w-full py-12 md:py-24 bg-card">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
                Submit Your Architectural Plans
              </h2>
              <p className="max-w-[85%] text-muted-foreground sm:text-lg">
                Upload your plans for automated compliance review. We&apos;ll analyze them against the latest building codes and route them accordingly.
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/submit-plan">Submit Your Plan</Link>
              </Button>
            </div>
          </div>
        </section>
        <HowItWorks />
      </div>
      <Footer />
    </main>
  );
}