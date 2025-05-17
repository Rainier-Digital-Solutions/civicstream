import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function Hero() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-background to-muted">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Streamline Your Architectural Plan Approvals
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Our AI-powered compliance review system automatically checks your plans against the latest building codes and routes them to the right people.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link href="#submission-form">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Submit Plans
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline">Learn How It Works</Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative h-[350px] w-full rounded-lg bg-muted/30 p-2 shadow-lg backdrop-blur overflow-hidden border border-border">
              <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/443383/pexels-photo-443383.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')] bg-cover bg-center opacity-10"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-primary/20 backdrop-blur-sm"></div>
              <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <div className="text-lg font-semibold">Automated Plan Review</div>
                <div className="grid grid-cols-3 gap-2 my-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-16 rounded border border-primary/20 bg-background/50 flex items-center justify-center"
                    >
                      <div className="h-12 w-12 bg-blue-100/20 backdrop-blur rounded"></div>
                    </div>
                  ))}
                </div>
                <div className="h-4 w-3/4 bg-gradient-to-r from-primary/40 to-transparent rounded-full"></div>
                <div className="h-4 w-1/2 bg-gradient-to-r from-primary/30 to-transparent rounded-full mt-2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}