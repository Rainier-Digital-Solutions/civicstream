import { Menu } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CivicStreamLogo } from './CivicStreamLogo';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center max-w-screen-xl w-full px-4 md:px-0 md:mx-auto">
        <Link href="/">
          <div className="flex gap-2 items-center mr-4">
            <CivicStreamLogo className="h-8 w-8" />
            <span className="text-xl font-semibold">CivicStream</span>
          </div>
        </Link>
        <nav className="flex flex-1 items-center justify-between">
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link
              href="#how-it-works"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              How It Works
            </Link>
            <Link
              href="#faq"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              FAQ
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="#contact"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Contact
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex flex-1 justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <button className="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <div className="flex flex-col gap-4 mt-6">
                  <Link
                    href="#how-it-works"
                    className="text-sm font-medium transition-colors hover:text-foreground/80 text-foreground/60"
                  >
                    How It Works
                  </Link>
                  <Link
                    href="#faq"
                    className="text-sm font-medium transition-colors hover:text-foreground/80 text-foreground/60"
                  >
                    FAQ
                  </Link>
                  <Link
                    href="#contact"
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Contact
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}