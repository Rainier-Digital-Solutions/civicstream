"use client";

import { Menu, User, LogOut, Settings, UserPlus, LogIn, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { CivicStreamLogo } from './CivicStreamLogo';

export function Navbar() {
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // Don't show navbar on auth pages
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'].includes(pathname);
  if (isAuthPage) return null;

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
              href="/dashboard"
              className={`transition-colors hover:text-foreground/80 ${pathname === '/dashboard' ? 'text-foreground' : 'text-foreground/60'}`}
            >
              Dashboard
            </Link>
            <Link
              href="/submit-plan"
              className={`transition-colors hover:text-foreground/80 ${pathname === '/submit-plan' ? 'text-foreground' : 'text-foreground/60'}`}
            >
              Submit Plan
            </Link>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.attributes?.picture} alt={user?.username} />
                      <AvatarFallback>
                        {user?.username?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.username || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.attributes?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <Link href="/profile">
                      <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/settings">
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Log in
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign up
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex flex-1 justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                {isAuthenticated ? (
                  <div className="flex flex-col gap-4 mt-6">
                    <div className="flex items-center gap-3 p-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.attributes?.picture} alt={user?.username} />
                        <AvatarFallback>
                          {user?.username?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user?.username || 'User'}</p>
                        <p className="text-sm text-muted-foreground">{user?.attributes?.email}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <Link href="/dashboard">
                        <Button variant="ghost" className="w-full justify-start">
                          Dashboard
                        </Button>
                      </Link>
                      <Link href="/submit-plan">
                        <Button variant="ghost" className="w-full justify-start">
                          Submit Plan
                        </Button>
                      </Link>
                      <Link href="/profile">
                        <Button variant="ghost" className="w-full justify-start">
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Button>
                      </Link>
                      <Link href="/settings">
                        <Button variant="ghost" className="w-full justify-start">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={handleSignOut}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 mt-6">
                    <Link href="/login">
                      <Button variant="outline" className="w-full">
                        <LogIn className="mr-2 h-4 w-4" />
                        Log in
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button className="w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create account
                      </Button>
                    </Link>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </header>
  );
}