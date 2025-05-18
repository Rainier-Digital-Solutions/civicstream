import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware handles CORS settings for the application
export function middleware(request: NextRequest) {
    // Get the response
    const response = NextResponse.next();

    const origin = request.headers.get('origin');
    const vercelEnv = process.env.VERCEL_ENV;

    // Only process if we have an origin header
    if (origin && request.nextUrl.pathname.startsWith('/api')) {
        // Allow both localhost variants in development
        // Local development will typically not have VERCEL_ENV set
        if (!vercelEnv && (origin === 'http://127.0.0.1:3000' || origin === 'http://localhost:3000')) {
            response.headers.set('Access-Control-Allow-Origin', origin);
        }
        // Production environment
        else if (vercelEnv === 'production' && origin === 'https://www.civicstream.io') {
            response.headers.set('Access-Control-Allow-Origin', 'https://www.civicstream.io');
        }
        // Preview/staging environment
        else if (vercelEnv === 'preview' && origin === 'https://test.civicstream.io') {
            response.headers.set('Access-Control-Allow-Origin', 'https://test.civicstream.io');
        }
        // Development environment on Vercel (unlikely but included for completeness)
        else if (vercelEnv === 'development' && (origin === 'http://127.0.0.1:3000' || origin === 'http://localhost:3000')) {
            response.headers.set('Access-Control-Allow-Origin', origin);
        }

        // Common CORS headers for all environments
        if (response.headers.has('Access-Control-Allow-Origin')) {
            response.headers.set('Access-Control-Allow-Credentials', 'true');
            response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
            response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
        }

        // Handle OPTIONS request (preflight)
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, { status: 204 });
        }
    }

    return response;
}

// Configure the middleware to only run on API routes
export const config = {
    matcher: '/api/:path*',
}; 