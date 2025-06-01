"use client";

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FileWithPreview } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { validatePDF, getFileSizeInMB } from '@/lib/pdf-utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, File, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const formSchema = z.object({
  submitterEmail: z.string().email('Please enter a valid email address'),
  cityPlannerEmail: z.string().email('Please enter a valid email address'),
  address: z.string().min(1, 'Address is required'),
  parcelNumber: z.string().min(1, 'Parcel number is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  projectSummary: z.string().optional(),
  useClaude: z.boolean().default(true), // Default to Claude
});

type FormValues = z.infer<typeof formSchema>;

// AWS API Gateway endpoint for direct submission
const AWS_API_ENDPOINT = 'https://sn1fh1nhzl.execute-api.us-west-2.amazonaws.com/prod/submit-plan';

// Simplified submission status type
type SubmissionStatusType = 'idle' | 'uploading' | 'success' | 'error';

export function SubmissionForm() {
  const [file, setFile] = useState<FileWithPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatusType>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submitterEmail: '',
      cityPlannerEmail: '',
      address: '',
      parcelNumber: '',
      city: '',
      county: '',
      projectSummary: '',
      useClaude: true,
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a PDF file",
        });
        return;
      }

      // Check file size (50MB limit)
      const fileSizeMB = getFileSizeInMB(file);
      if (fileSizeMB > 50) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload a PDF file smaller than 50MB",
        });
        return;
      }

      // Validate PDF
      validatePDF(file).then(isValid => {
        if (!isValid) {
          toast({
            variant: "destructive",
            title: "Invalid PDF",
            description: "The file appears to be corrupted or invalid",
          });
          return;
        }

        const fileWithPreview = Object.assign(file, {
          preview: URL.createObjectURL(file),
        });

        setFile(fileWithPreview);
      });
    }
  }, [toast]);

  // Cleanup preview URL when file is removed
  useEffect(() => {
    return () => {
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
    };
  }, [file]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    multiple: false,
  });

  // Convert file to base64 for AWS submission
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please upload an architectural plan PDF",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus('uploading');
    setUploadProgress(0);

    try {
      // Convert file to base64 for direct AWS submission
      console.log(`Converting file (${(file.size / (1024 * 1024)).toFixed(2)}MB) to base64 for AWS submission`);
      setUploadProgress(25);
      
      const base64Data = await fileToBase64(file);
      setUploadProgress(50);
      
      console.log(`File converted to base64, length: ${base64Data.length}`);

      // Prepare submission data for AWS API Gateway (matching Lambda function expected fields)
      const submissionData = {
        fileName: file.name,
        pdfBuffer: base64Data,
        submitterEmail: data.submitterEmail,
        cityPlannerEmail: data.cityPlannerEmail,
        address: data.address,
        parcelNumber: data.parcelNumber,
        city: data.city,
        county: data.county,
        projectSummary: data.projectSummary || ''
      };

      setUploadProgress(75);
      
      // Submit directly to AWS API Gateway endpoint
      console.log('Submitting to AWS API Gateway:', AWS_API_ENDPOINT);
      const response = await fetch(AWS_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setUploadProgress(100);
      setSubmissionStatus('success');

      toast({
        title: 'Plan submitted successfully!',
        description: 'Your plan is being analyzed. You will receive the results via email once processing is complete.',
      });

      // Brief delay to show success state before resetting
      setTimeout(() => {
        form.reset();
        setFile(null);
        setUploadProgress(0);
        setSubmissionStatus('idle');
      }, 1500);

    } catch (error) {
      console.error('Error submitting plan:', error);
      setSubmissionStatus('error');

      toast({
        variant: 'destructive',
        title: 'Failed to submit plan',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="submission-form" className="w-full py-12 md:py-24 bg-card">
      <div className="container px-4 md:px-6">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
            Submit Your Architectural Plans
          </h2>
          <p className="max-w-[85%] text-muted-foreground sm:text-lg">
            Upload your plans for automated compliance review. We&apos;ll analyze them against the latest building codes and route them accordingly.
          </p>
        </div>

        <Card className="mx-auto mt-8 max-w-[800px]">
          <CardHeader>
            <CardTitle>Plan Submission</CardTitle>
            <CardDescription>
              Upload your architectural plan PDF and provide the necessary project details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-border",
                    isDragReject ? "border-destructive bg-destructive/5" : "",
                    file ? "border-success bg-success/5" : ""
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center space-y-4">
                    {file ? (
                      <>
                        <CheckCircle className="h-12 w-12 text-success" />
                        <div>
                          <p className="text-lg font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          Change File
                        </Button>
                      </>
                    ) : (
                      <>
                        {isDragActive ? (
                          <Upload className="h-12 w-12 text-primary animate-pulse" />
                        ) : (
                          <File className="h-12 w-12 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-lg font-medium">
                            Drag & drop your architectural plan
                          </p>
                          <p className="text-sm text-muted-foreground">
                            PDF files only, max 50MB
                          </p>
                        </div>
                        <Button type="button" variant="outline">
                          Browse Files
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Upload progress bar */}
                {isSubmitting && uploadProgress > 0 && submissionStatus === 'uploading' && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground text-center">
                      {uploadProgress < 50
                        ? `Preparing file: ${uploadProgress}%`
                        : uploadProgress < 75
                          ? 'Converting file for submission...'
                          : uploadProgress < 100
                            ? 'Submitting to analysis queue...'
                            : 'Submission complete!'}
                    </p>
                  </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="submitterEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          We&apos;ll send you the review results.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cityPlannerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City Planner Email</FormLabel>
                        <FormControl>
                          <Input placeholder="planner@city.gov" {...field} />
                        </FormControl>
                        <FormDescription>
                          Compliant plans will be sent here.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Address</FormLabel>
                        <FormControl>
                          <Input placeholder="1234 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcelNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcel Number</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Seattle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <FormControl>
                          <Input placeholder="King County" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="projectSummary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Summary (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the project" {...field} />
                      </FormControl>
                      <FormDescription>
                        Provide a brief overview of your project (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="useClaude"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Use Claude AI for Analysis
                        </FormLabel>
                        <FormDescription>
                          Use Anthropic&apos;s Claude instead of OpenAI for plan review (recommended)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting || !file}
                  >
                    {isSubmitting ? (
                      <>
                        {submissionStatus === 'uploading' && (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        )}
                        {submissionStatus === 'success' && (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Submitted!
                          </>
                        )}
                        {submissionStatus === 'error' && (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Failed
                          </>
                        )}
                      </>
                    ) : (
                      'Submit Plan'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-4 w-4" />
              Your data is encrypted and securely processed
            </div>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}