"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileWithPreview } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { validatePDF, getFileSizeInMB } from '@/lib/pdf-utils';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, File, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const formSchema = z.object({
  submitterEmail: z.string().email('Please enter a valid email address'),
  cityPlannerEmail: z.string().email('Please enter a valid email address'),
  address: z.string().min(1, 'Address is required'),
  parcelNumber: z.string().min(1, 'Parcel number is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  projectSummary: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function SubmissionForm() {
  const [file, setFile] = useState<FileWithPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
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

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    multiple: false,
  });

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

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submitterEmail', data.submitterEmail);
      formData.append('cityPlannerEmail', data.cityPlannerEmail);
      formData.append('address', data.address);
      formData.append('parcelNumber', data.parcelNumber);
      formData.append('city', data.city);
      formData.append('county', data.county);
      if (data.projectSummary) {
        formData.append('projectSummary', data.projectSummary);
      }

      console.log('API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
      console.log('Full API URL:', `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/submit-plan`);

      console.log('Submitting plan for review:', {
        fileName: file.name,
        fileSize: file.size,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        submitterEmail: data.submitterEmail,
        cityPlannerEmail: data.cityPlannerEmail,
        address: data.address,
        parcelNumber: data.parcelNumber,
        city: data.city,
        county: data.county,
        hasProjectSummary: !!data.projectSummary
      });

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const apiUrl = `${apiBaseUrl}/api/submit-plan`;
      console.log('Making request to:', apiUrl);
      console.log('Environment:', process.env.VERCEL_ENV);
      console.log('API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit plan';

        // Handle specific error cases
        if (response.status === 413) {
          errorMessage = 'The file is too large. Please try a smaller file or compress it before uploading.';
        } else {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            try {
              const text = await response.text();
              errorMessage = text || errorMessage;
            } catch (e) {
              errorMessage = response.statusText || errorMessage;
            }
          }
        }

        throw new Error(errorMessage);
      }

      setSubmissionStatus('processing');

      const result = await response.json();
      console.log('Submission result:', result);

      setSubmissionStatus('success');

      toast({
        title: "Plan submitted successfully",
        description: `Your architectural plan has been submitted for review. ${result.isCompliant
          ? 'The plan appears to be compliant and has been forwarded to the city planner.'
          : 'The plan requires some adjustments and has been returned to your email.'
          }`,
      });

      form.reset();
      setFile(null);
    } catch (error) {
      console.error('Error submitting plan:', error);
      setSubmissionStatus('error');
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error instanceof Error ? error.message : "There was an error submitting your plan. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSubmissionStatus('idle');
      }, 3000);
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
                        {submissionStatus === 'processing' && (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
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