'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Loader2, 
  Mail, 
  PlusCircle 
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
}

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  // Using useCallback to memoize the function to avoid dependency issues
  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions?userId=${user?.attributes.sub}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      } else {
        console.error('Error fetching submissions:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch submissions when component mounts and periodically refresh
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchSubmissions();
      
      // Set up polling for status updates every 30 seconds
      const intervalId = setInterval(() => {
        fetchSubmissions();
      }, 30000);
      
      // Clean up interval on component unmount
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, user, fetchSubmissions]);

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
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredSubmissions = activeTab === 'all' 
    ? submissions 
    : submissions.filter(submission => submission.status.toLowerCase() === activeTab);

  // Calculate statistics
  const totalSubmissions = submissions.length;
  const processingSubmissions = submissions.filter(s => s.status === 'Processing').length;
  const completedSubmissions = submissions.filter(s => s.status === 'Analysis Complete' || s.status === 'Findings Report Emailed').length;
  const emailedSubmissions = submissions.filter(s => s.status === 'Findings Report Emailed').length;

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-grow mx-auto max-w-screen-xl w-full px-4 py-8">
        {loading || isLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-lg">Loading your dashboard...</p>
            </div>
          </div>
        ) : isAuthenticated ? (
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight">Your Dashboard</h1>
              <p className="text-lg text-muted-foreground mt-2">
                Track and manage your architectural plan submissions
              </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalSubmissions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{processingSubmissions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Complete</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{completedSubmissions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Reports Emailed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{emailedSubmissions}</div>
                </CardContent>
              </Card>
            </div>

            {/* Submissions Table */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Your Submissions</CardTitle>
                <CardDescription>
                  Track the status of your architectural plan submissions
                </CardDescription>
                <div className="mt-4">
                  <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="processing">Processing</TabsTrigger>
                      <TabsTrigger value="analysis complete">Analysis Complete</TabsTrigger>
                      <TabsTrigger value="findings report emailed">Emailed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
                    <p className="text-muted-foreground mb-6">
                      You haven&apos;t submitted any architectural plans for review yet.
                    </p>
                    <Button asChild>
                      <Link href="/submit-plan">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Submit Your First Plan
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>A list of your recent submissions</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Submission Date</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubmissions.map((submission) => (
                          <TableRow key={submission.submissionId}>
                            <TableCell>
                              <div className="font-medium">{formatDate(submission.createdAt)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{submission.address}</div>
                              <div className="text-sm text-muted-foreground">{submission.city}, {submission.county}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{submission.fileName}</div>
                              <div className="text-sm text-muted-foreground">{formatFileSize(submission.fileSize)}</div>
                            </TableCell>
                            <TableCell>{getStatusBadge(submission.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link href={`/dashboard/submission/${submission.submissionId}`}>
                                  View Details
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button asChild>
                  <Link href="/submit-plan">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Submit New Plan
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/profile">
                    Update Profile
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
      <Footer />
    </main>
  );
}
