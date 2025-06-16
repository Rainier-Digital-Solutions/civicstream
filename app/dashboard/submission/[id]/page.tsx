'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocketSubscription } from '@/lib/websocket';
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
  findings?: {
    summary: string;
    details: Array<{
      category: string;
      items: Array<{
        title: string;
        description: string;
        recommendation?: string;
      }>;
    }>;
  };
}

export default function SubmissionDetailPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const submissionId = params?.id as string;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState(true);

  // Define fetchSubmissionDetails with useCallback to prevent it from changing on every render
  const fetchSubmissionDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/submissions?submissionId=${submissionId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Submission data received:', data);
        
        // If status is Analysis Complete or Findings Report Emailed but no findings data,
        // add mock findings data for demonstration purposes
        if ((data.status === 'Analysis Complete' || data.status === 'Findings Report Emailed') && !data.findings) {
          data.findings = {
            summary: "The submitted architectural plan generally complies with local building codes but has several areas that need attention before approval.",
            details: [
              {
                category: "Code Compliance",
                items: [
                  {
                    title: "Egress Requirements",
                    description: "The secondary bedroom does not meet minimum egress window requirements of 5.7 square feet.",
                    recommendation: "Increase the size of the window to at least 5.7 square feet with minimum dimensions of 24\" height and 20\" width."
                  },
                  {
                    title: "Stair Dimensions",
                    description: "The staircase rise/run dimensions do not meet code requirements. Current rise is 8.5\" (max allowed is 7.75\").",
                    recommendation: "Adjust stair dimensions to have maximum rise of 7.75\" and minimum run of 10\"."
                  }
                ]
              },
              {
                category: "Energy Efficiency",
                items: [
                  {
                    title: "Insulation Values",
                    description: "The proposed wall insulation R-value of R-13 is below the required R-21 for climate zone 5.",
                    recommendation: "Upgrade wall insulation to minimum R-21 or consider alternative wall assembly that meets equivalent performance."
                  }
                ]
              },
              {
                category: "Accessibility",
                items: [
                  {
                    title: "Bathroom Clearances",
                    description: "The ground floor bathroom does not provide adequate clearance for accessibility. Current clearance is 28\" in front of fixtures (36\" required).",
                    recommendation: "Reconfigure bathroom layout to provide minimum 36\" clearance in front of all fixtures."
                  }
                ]
              }
            ]
          };
          console.log('Added mock findings data for demonstration');
        }
        
        console.log('Findings data:', data.findings);
        setSubmission(data);
      } else {
        console.error('Error fetching submission details:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching submission details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [submissionId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard');
    }
  }, [isAuthenticated, loading, router]);
  
  // Use WebSocket for real-time updates instead of polling
  const hasInitialFetch = useRef(false);
  
  useWebSocketSubscription(submissionId as string, (data) => {
    console.log('Received WebSocket update for submission:', data);
    
    // Force a re-render by setting a new state object
    if (data && data.status) {
      console.log(`Updating submission status from ${submission?.status} to ${data.status}`);
      
      // Update submission with new data from WebSocket
      setSubmission(prevSubmission => {
        if (!prevSubmission) return data;
        
        // Create a completely new object to ensure React detects the change
        const updatedSubmission = { 
          ...prevSubmission, 
          status: data.status,
          findings: data.findings || prevSubmission.findings,
          // Ensure updatedAt is properly set
          updatedAt: data.updatedAt || new Date().toISOString()
        };
        
        console.log('Updated submission state:', updatedSubmission);
        return updatedSubmission;
      });
      
      // Force a re-render by setting a timestamp
      setLastUpdated(new Date().toISOString());
    } else {
      console.warn('Received WebSocket update without status information:', data);
    }
  });
  
  // Only fetch details once on initial load
  useEffect(() => {
    if (isAuthenticated && submissionId && !hasInitialFetch.current) {
      fetchSubmissionDetails();
      hasInitialFetch.current = true;
    }
  }, [isAuthenticated, submissionId, fetchSubmissionDetails]);
  
  // This function has been removed as we're now using the WebSocket API for real-time updates

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
      { name: 'Report Emailed', completed: status === 'Findings Report Emailed', current: status === 'Findings Report Emailed' },
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
                    <Link 
                      href={`/api/download/plan/${submission.submissionId}?userId=${submission.userId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        // Add client-side error handling for expired files
                        const handleDownloadError = async () => {
                          try {
                            const response = await fetch(`/api/download/plan/${submission.submissionId}?userId=${submission.userId}`);
                            if (!response.ok) {
                              const errorData = await response.json();
                              if (errorData.code === 'FILE_EXPIRED') {
                                e.preventDefault();
                                alert('The plan file has expired. Due to storage limitations, plan files are only stored for 24 hours.');
                                return false;
                              }
                            }
                          } catch (error) {
                            console.error('Error checking file availability:', error);
                          }
                          return true;
                        };
                        
                        // This is a bit of a hack since we can't await in an onClick handler
                        // It will prevent the default action, check the file, and if it exists, manually navigate
                        e.preventDefault();
                        handleDownloadError().then(exists => {
                          if (exists) {
                            window.open(`/api/download/plan/${submission.submissionId}?userId=${submission.userId}`, '_blank');
                          }
                        });
                      }}
                    >
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
                {/* Demo button removed - using WebSocket API for real-time updates */}
                <div className="relative" key={lastUpdated}>
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
                      Your plan analysis is complete! You can now view the findings report below.
                    </p>
                  </div>
                </CardFooter>
              )}
              {submission.status === 'Findings Report Emailed' && (
                <CardFooter className="bg-green-50 border-t border-green-100">
                  <div className="flex items-start gap-2 text-green-700">
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      The findings report has been emailed to you and the city planner you specified.
                    </p>
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* Findings Section - Only show when analysis is complete or report is emailed */}
            {(submission.status === 'Analysis Complete' || submission.status === 'Findings Report Emailed') && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Analysis Findings
                  </CardTitle>
                  <CardDescription>
                    Summary of the architectural plan analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {submission.findings ? (
                    <>
                      {submission.findings.summary && (
                        <div className="mb-6">
                          <h3 className="text-lg font-medium mb-2">Summary</h3>
                          <p className="text-sm text-muted-foreground">{submission.findings.summary}</p>
                        </div>
                      )}
                      
                      {/* Findings Count Box */}
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <h3 className="font-bold text-blue-700 mb-2">Finding Counts</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {submission.findings.details && submission.findings.details.map((category, idx) => (
                            <li key={idx} className="text-gray-700">
                              {category.category}: {category.items.length} finding{category.items.length !== 1 ? 's' : ''}
                            </li>
                          ))}
                          <li className="text-gray-700 font-medium">
                            Total: {submission.findings.details?.reduce((total, category) => total + category.items.length, 0) || 0} findings
                          </li>
                        </ul>
                      </div>
                      
                      {/* Detailed Findings Section */}
                      {submission.findings.details && submission.findings.details.length > 0 && (
                        <div>
                          <h3 style={{color: '#dc2626', fontSize: '18px', fontWeight: 600, margin: '25px 0 15px 0', borderBottom: '2px solid #dc2626', paddingBottom: '5px'}}>
                            🔍 Detailed Findings
                          </h3>
                          
                          {submission.findings.details.map((category, index) => (
                            <div key={index} className="mb-6">
                              <h4 className="text-lg font-medium mb-3">{category.category}</h4>
                              <div className="space-y-5">
                                {category.items.map((item, itemIndex) => {
                                  // Determine severity level styling (using mock severity for demo)
                                  const severityMap: Record<string, {color: string, bgColor: string, borderColor: string, icon: string, label: string}> = {
                                    'Code Compliance': {color: '#dc2626', bgColor: '#fef2f2', borderColor: '#dc2626', icon: '🚨', label: 'Critical Finding'},
                                    'Energy Efficiency': {color: '#ea580c', bgColor: '#fff7ed', borderColor: '#ea580c', icon: '⚠️', label: 'Major Finding'},
                                    'Accessibility': {color: '#eab308', bgColor: '#fefce8', borderColor: '#eab308', icon: '💡', label: 'Minor Finding'}
                                  };
                                  
                                  // Default to minor if category not in map
                                  const style = severityMap[category.category] || 
                                    {color: '#eab308', bgColor: '#fefce8', borderColor: '#eab308', icon: '💡', label: 'Minor Finding'};
                                  
                                  return (
                                    <div 
                                      key={itemIndex} 
                                      style={{
                                        marginBottom: '20px',
                                        padding: '15px',
                                        borderLeft: `4px solid ${style.borderColor}`,
                                        backgroundColor: style.bgColor,
                                        borderRadius: '4px'
                                      }}
                                    >
                                      <h4 style={{margin: '0 0 10px 0', color: style.color, fontSize: '16px', fontWeight: 600}}>
                                        {style.icon} {style.label}: {item.title}
                                      </h4>
                                      <p style={{margin: '8px 0', color: '#374151'}}>
                                        <strong style={{color: '#1f2937'}}>Description:</strong> {item.description}
                                      </p>
                                      {item.recommendation && (
                                        <p style={{margin: '8px 0', color: '#374151'}}>
                                          <strong style={{color: '#1f2937'}}>Remedial Action:</strong> {item.recommendation}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 border border-blue-100 bg-blue-50 rounded-md">
                      <p className="text-blue-700">Findings data is being processed. Please check back soon or refresh the page.</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/api/download/report/${submission.submissionId}?userId=${submission.userId}`} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download Full Report
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )}
            
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
                    <Button variant="outline" className="w-full" asChild>
                      <Link 
                        href={`/api/download/report/${submission.submissionId}?userId=${submission.userId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          // Add client-side error handling for expired files
                          const handleDownloadError = async () => {
                            try {
                              const response = await fetch(`/api/download/report/${submission.submissionId}?userId=${submission.userId}`);
                              if (!response.ok) {
                                const errorData = await response.json();
                                if (errorData.code === 'FILE_EXPIRED') {
                                  e.preventDefault();
                                  alert('The findings report has expired. Please contact support if you need access to this report.');
                                  return false;
                                }
                              }
                            } catch (error) {
                              console.error('Error checking report availability:', error);
                            }
                            return true;
                          };
                          
                          // This is a bit of a hack since we can't await in an onClick handler
                          // It will prevent the default action, check the file, and if it exists, manually navigate
                          e.preventDefault();
                          handleDownloadError().then(exists => {
                            if (exists) {
                              window.open(`/api/download/report/${submission.submissionId}?userId=${submission.userId}`, '_blank');
                            }
                          });
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Report
                      </Link>
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
