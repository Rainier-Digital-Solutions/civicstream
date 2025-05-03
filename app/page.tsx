import { Navbar } from '@/components/navbar';
import { Hero } from '@/components/hero';
import { SubmissionForm } from '@/components/submission-form';
import { HowItWorks } from '@/components/how-it-works';
import { Footer } from '@/components/footer';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow mx-auto max-w-screen-xl">
        <Hero />
        <SubmissionForm />
        <HowItWorks />
      </div>
      <Footer />
    </main>
  );
}