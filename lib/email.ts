import nodemailer from 'nodemailer';
import { ReviewResult } from './openai';

// Email configuration
const isSecure = process.env.EMAIL_SECURE === 'true';
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: isSecure ? 465 : 587,
  secure: isSecure,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
});

export interface EmailDetails {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export async function sendEmail(details: EmailDetails): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@civicstream.com',
      to: details.to,
      subject: details.subject,
      html: details.html,
      attachments: details.attachments,
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function routeReviewResults(
  reviewResult: ReviewResult,
  pdfBuffer: Buffer,
  fileName: string,
  submitterEmail: string,
  cityPlannerEmail: string
): Promise<boolean> {
  try {
    const attachment = {
      filename: fileName,
      content: pdfBuffer,
      contentType: 'application/pdf',
    };

    if (reviewResult.isCompliant) {
      // Send to city planner if compliant
      const plannerEmailDetails: EmailDetails = {
        to: cityPlannerEmail,
        subject: 'Compliant Architectural Plan for Review',
        html: reviewResult.cityPlannerEmailBody,
        attachments: [attachment],
      };
      await sendEmail(plannerEmailDetails);
    } else {
      // Send back to submitter if non-compliant
      const submitterEmailDetails: EmailDetails = {
        to: submitterEmail,
        subject: 'Architectural Plan Review Results - Action Required',
        html: reviewResult.submitterEmailBody,
        attachments: [attachment],
      };
      await sendEmail(submitterEmailDetails);
    }
    return true;
  } catch (error) {
    console.error('Error routing review results:', error);
    return false;
  }
}