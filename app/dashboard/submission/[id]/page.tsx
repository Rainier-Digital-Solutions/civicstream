'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  Download, 
  FileText, 
  Loader2, 
  Mail,
  MapPin,
  Calendar,
  Building,
  Hash,
  Info
} from 'lucide-react';
import Link from 'next/link';

interface Submission {
  submissionId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  address: string;
  parcelNumber: string;
  city: string;
  county: string;
  status: 'Processing' | 'Analysis Complete' | 'Findings Report Emailed';
  createdAt: string;
  updatedAt: string;
  projectSummary?: string;
}

export default function SubmissionDetailPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const submissionId = params?.id as string;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch submission details when component mounts
  useEffect(() => {
    if (isAuthenticated && submissionId) {
      fetchSubmissionDetails();
    }
  }, [isAuthenticated, submissionId]);

  const fetchSubmissionDetails = async () => {
    try {
      const response = await fetch(`/api/submissions?submissionId=${submissionId}`);
      if (response.ok) {
        const data = await response.json();
        setSubmission(data);
      } else {
        console.error('Error fetching submission details:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching submission details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Processing':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3" />
            Processing
          </Badge>
        );
      case 'Analysis Complete':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <CheckCircle className="h-3 w-3" />
            Analysis Complete
          </Badge>
        );
      case 'Findings Report Emailed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200">
            <Mail className="h-3 w-3" />
            Report Emailed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Processing':
        return "Your plan is currently being analyzed by Anthropic's Claude AI. This process typically takes 5-10 minutes depending on the complexity of your plans.";
      case 'Analysis Complete':
        return "The analysis of your plan is complete. The findings report is ready for review.";
      case 'Findings Report Emailed':
        return "The findings report has been emailed to you and the city planner you specified.";
      default:
        return "Status information is not available.";
    }
  };

  const getStatusTimeline = (status: string) => {
    const steps = [
      { name: 'Submitted', completed: true, current: false },
      { name: 'Processing', completed: status !== 'Processing', current: status === 'Processing' },
      { name: 'Analysis Complete', completed: status === 'Findings Report Emailed', current: status === 'Analysis Complete' },
      { name: 'Report Emailed', completed: false, current: status === 'Findings Report Emailed' },
    ];

    return steps;
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-grow mx-auto max-w-screen-xl w-full px-4 py-8">
        {loading || isLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-lg">Loading submission details...</p>
            </div>
          </div>
        ) : isAuthenticated && submission ? (
          <>
            <div className="mb-6">
              <Button variant="ghost" className="mb-4" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Submission Details</h1>
                  <p className="text-lg text-muted-foreground mt-1">
                    {submission.address}, {submission.city}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(submission.status)}
                  <Button variant="outline" asChild>
                    <Link href="#" onClick={(e) => e.preventDefault()}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Plan
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {submission.status === 'Processing' && <Clock className="h-5 w-5 text-amber-500" />}
                  {submission.status === 'Analysis Complete' && <CheckCircle className="h-5 w-5 text-blue-500" />}
                  {submission.status === 'Findings Report Emailed' && <Mail className="h-5 w-5 text-green-500" />}
                  Current Status: {submission.status}
                </CardTitle>
                <CardDescription>
                  {getStatusDescription(submission.status)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="flex items-center justify-between w-full mb-2">
                    {getStatusTimeline(submission.status).map((step, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${
                          step.completed 
                            ? 'bg-primary border-primary text-primary-foreground' 
                            : step.current 
                              ? 'bg-primary/20 border-primary text-primary' 
                              : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <span className={`text-xs mt-1 ${
                          step.completed || step.current ? 'font-medium' : 'text-muted-foreground'
                        }`}>
                          {step.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted-foreground/20"></div>
                </div>

                <div className="mt-6 text-sm text-muted-foreground">
                  <p>Last updated: {formatDate(submission.updatedAt)}</p>
                </div>
              </CardContent>
              {submission.status === 'Processing' && (
                <CardFooter className="bg-amber-50 border-t border-amber-100">
                  <div className="flex items-start gap-2 text-amber-700">
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      Processing typically takes 5-10 minutes. You don&apos;t need to stay on this page - 
                      we&apos;ll email you when the analysis is complete.
                    </p>
                  </div>
                </CardFooter>
              )}
              {submission.status === 'Analysis Complete' && (
                <CardFooter className="bg-blue-50 border-t border-blue-100">
                  <div className="flex items-start gap-2 text-blue-700">
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      Your plan analysis is complete! You can now view the findings report.
                    </p>
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* Submission Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Project Information */}
              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle>Project Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Address
                      </p>
                      <p>{submission.address}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        City & County
                      </p>
                      <p>{submission.city}, {submission.county}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        Parcel Number
                      </p>
                      <p>{submission.parcelNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Submission Date
                      </p>
                      <p>{formatDate(submission.createdAt)}</p>
                    </div>
                  </div>

                  {submission.projectSummary && (
                    <div className="space-y-1 pt-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        Project Summary
                      </p>
                      <p className="text-sm text-muted-foreground">{submission.projectSummary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Information */}
              <Card>
                <CardHeader>
                  <CardTitle>File Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="bg-muted rounded-lg p-2">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{submission.fileName}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(submission.fileSize)}</p>
                    </div>
                  </div>

                  <Button className="w-full" asChild>
                    <Link href="#" onClick={(e) => e.preventDefault()}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Plan
                    </Link>
                  </Button>

                  {submission.status === 'Analysis Complete' || submission.status === 'Findings Report Emailed' ? (
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Report
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      <Clock className="mr-2 h-4 w-4" />
                      Report Pending
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Submission Not Found</h3>
              <p className="text-muted-foreground mb-6">
                The submission you&apos;re looking for couldn&apos;t be found.
              </p>
              <Button asChild>
                <Link href="/dashboard">
                  Return to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
