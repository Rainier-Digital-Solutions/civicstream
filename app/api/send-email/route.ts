import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ReviewResult } from '@/lib/openai';
// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Email configuration
const isSecure = process.env.EMAIL_SECURE === 'true';
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: isSecure ? 465 : 587,
    secure: isSecure,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || '',
    },
};

// Log email configuration (without sensitive data)
console.log('[Email] Initializing with configuration:', {
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    hasUser: !!emailConfig.auth.user,
    hasPassword: !!emailConfig.auth.pass,
    from: process.env.EMAIL_FROM || 'noreply@civicstream.com'
});

// Validate email configuration
if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.error('[Email] Missing email configuration:', {
        hasHost: !!emailConfig.host,
        hasUser: !!emailConfig.auth.user,
        hasPassword: !!emailConfig.auth.pass,
        isSecure,
        port: emailConfig.port
    });
}

const transporter = nodemailer.createTransport(emailConfig);

// Verify transporter configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error('[Email] Transporter verification failed:', error);
    } else {
        console.log('[Email] Transporter is ready to send messages');
    }
});

export async function POST(req: NextRequest) {
    console.log('[Email] Received email request');

    try {
        const body = await req.json();
        const {
            reviewResult,
            pdfBuffer,
            fileName,
            submitterEmail,
            cityPlannerEmail,
        } = body;

        // Log request data (excluding sensitive information)
        console.log('[Email] Request data:', {
            hasReviewResult: !!reviewResult,
            hasPdfBuffer: !!pdfBuffer,
            fileName,
            submitterEmail,
            cityPlannerEmail,
            isCompliant: reviewResult?.isCompliant
        });

        if (!reviewResult || !pdfBuffer || !fileName || !submitterEmail || !cityPlannerEmail) {
            console.error('[Email] Missing required fields:', {
                hasReviewResult: !!reviewResult,
                hasPdfBuffer: !!pdfBuffer,
                hasFileName: !!fileName,
                hasSubmitterEmail: !!submitterEmail,
                hasCityPlannerEmail: !!cityPlannerEmail
            });
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const attachment = {
            filename: fileName,
            content: Buffer.from(pdfBuffer, 'base64'),
            contentType: 'application/pdf',
        };

        const emailOptions = {
            from: process.env.EMAIL_FROM || 'noreply@civicstream.com',
            to: reviewResult.isCompliant ? cityPlannerEmail : submitterEmail,
            subject: reviewResult.isCompliant
                ? 'Compliant Architectural Plan for Review'
                : 'Architectural Plan Review Results - Action Required',
            html: reviewResult.isCompliant
                ? reviewResult.cityPlannerEmailBody
                : reviewResult.submitterEmailBody,
            attachments: [attachment],
        };

        console.log('[Email] Attempting to send email:', {
            to: emailOptions.to,
            subject: emailOptions.subject,
            attachmentSize: attachment.content.length,
            from: emailOptions.from
        });

        try {
            const info = await transporter.sendMail(emailOptions);
            console.log('[Email] Email sent successfully:', {
                messageId: info.messageId,
                response: info.response
            });
            return NextResponse.json({ success: true });
        } catch (sendError) {
            console.error('[Email] Failed to send email:', {
                error: sendError,
                errorMessage: sendError instanceof Error ? sendError.message : 'Unknown error',
                errorStack: sendError instanceof Error ? sendError.stack : undefined,
                emailConfig: {
                    host: emailConfig.host,
                    port: emailConfig.port,
                    secure: emailConfig.secure,
                    hasAuth: !!emailConfig.auth.user && !!emailConfig.auth.pass
                }
            });
            throw sendError;
        }
    } catch (error) {
        console.error('[Email] Error processing email request:', {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            { error: 'Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
} 