import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FileSearch, Mail, FileCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full py-12 md:py-24">
      <div className="container px-4 md:px-6">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
            How It Works
          </h2>
          <p className="max-w-[85%] text-muted-foreground sm:text-lg">
            Our automated system streamlines the architectural plan review process, saving you time and reducing errors.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:gap-12 md:grid-cols-3 mt-12">
          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-chart-1"></div>
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-chart-1 mb-2">
                <div className="bg-chart-1/10 p-3 rounded-full">
                  <FileSearch className="h-6 w-6" />
                </div>
                <span className="text-lg font-semibold">Step 1</span>
              </div>
              <CardTitle className="text-xl">Upload Your Plans</CardTitle>
              <CardDescription>
                Submit your architectural plans (PDF) and provide contact information.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-1 mt-0.5 shrink-0" />
                  <span>Secure upload of PDF architectural plans</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-1 mt-0.5 shrink-0" />
                  <span>Provide your email and city planner contact</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-1 mt-0.5 shrink-0" />
                  <span>Automated receipt confirmation</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-chart-2"></div>
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-chart-2 mb-2">
                <div className="bg-chart-2/10 p-3 rounded-full">
                  <FileCheck className="h-6 w-6" />
                </div>
                <span className="text-lg font-semibold">Step 2</span>
              </div>
              <CardTitle className="text-xl">AI Plan Review</CardTitle>
              <CardDescription>
                Our AI system analyzes your plans against current building codes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
                  <span>Advanced AI analyzes plan details</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
                  <span>Cross-references with latest building codes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
                  <span>Identifies and rates severity of violations</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-chart-3"></div>
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2 text-chart-3 mb-2">
                <div className="bg-chart-3/10 p-3 rounded-full">
                  <Mail className="h-6 w-6" />
                </div>
                <span className="text-lg font-semibold">Step 3</span>
              </div>
              <CardTitle className="text-xl">Smart Routing</CardTitle>
              <CardDescription>
                Results are automatically sent to the appropriate recipient.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-3 mt-0.5 shrink-0" />
                  <span>Compliant plans sent directly to city planner</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-3 mt-0.5 shrink-0" />
                  <span>Non-compliant plans returned with feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-3 mt-0.5 shrink-0" />
                  <span>Detailed remediation steps provided</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto max-w-5xl mt-12 bg-muted p-6 md:p-10 rounded-lg">
          <h3 className="text-2xl font-bold mb-6">Decision Logic</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-success bg-success/5">
              <CardHeader>
                <CardTitle className="flex items-center text-success">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Compliant Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  Plans with no critical findings and fewer than 5 minor findings are considered compliant.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>Submitter</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>City Planner</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-destructive bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Non-Compliant Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  Plans with any critical findings or 5+ minor findings are returned for correction.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>Submitter</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>Submitter (with feedback)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}