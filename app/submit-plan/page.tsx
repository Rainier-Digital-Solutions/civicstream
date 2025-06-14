'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SubmissionForm } from '@/components/submission-form';
import { Footer } from '@/components/footer';

export default function SubmitPlanPage() {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login?redirect=/submit-plan');
        }
    }, [isAuthenticated, loading, router]);

    // Show loading state or the form if authenticated
    return (
        <main className="min-h-screen flex flex-col">
            <div className="flex-grow mx-auto max-w-screen-xl w-full">
                {loading ? (
                    <div className="flex items-center justify-center h-screen">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-lg">Loading...</p>
                        </div>
                    </div>
                ) : isAuthenticated ? (
                    <>
                        <div className="container px-4 md:px-6 py-8">
                            <h1 className="text-4xl font-bold tracking-tight mb-4">Submit Your Plan</h1>
                            <p className="text-lg text-muted-foreground mb-8">
                                Upload your architectural plans for automated compliance review. We&apos;ll analyze them against the latest building codes.
                            </p>
                        </div>
                        <SubmissionForm />
                    </>
                ) : null}
            </div>
            <Footer />
        </main>
    );
}
