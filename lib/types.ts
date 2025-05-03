export interface Submission {
  id: string;
  fileName: string;
  submitterEmail: string;
  cityPlannerEmail: string;
  status: 'pending' | 'reviewing' | 'completed' | 'failed';
  submittedAt: Date;
  completedAt?: Date;
  isCompliant?: boolean;
  errorMessage?: string;
}

export type SubmissionStatus = Submission['status'];

export interface FileWithPreview extends File {
  preview: string;
}