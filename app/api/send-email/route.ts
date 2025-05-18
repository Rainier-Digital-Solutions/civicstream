// Force Node.js runtime and dynamic execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Add detailed logging for email configuration
console.log('[Email] Email configuration:', {
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
        user: emailConfig.auth.user,
        hasPassword: !!emailConfig.auth.pass,
        passwordLength: emailConfig.auth.pass?.length
    }
});

export async function POST(req: NextRequest) {
    console.log('[Email] Received email request');

    // Log email configuration (without sensitive data)
    console.log('[Email] Current configuration:', {
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
        return NextResponse.json(
            { error: 'Email configuration is incomplete' },
            { status: 500 }
        );
    }

    // Verify transporter configuration
    try {
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    console.error('[Email] Transporter verification failed:', {
                        error: error.message,
                        code: (error as any).code,
                        command: (error as any).command
                    });
                    reject(error);
                } else {
                    console.log('[Email] Transporter is ready to send messages');
                    resolve(success);
                }
            });
        });
    } catch (error) {
        console.error('[Email] Failed to verify transporter:', error);
        return NextResponse.json(
            { error: 'Failed to verify email configuration: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const {
            reviewResult,
            blobUrl,
            fileName,
            submitterEmail,
            cityPlannerEmail,
        } = body;

        // Log request data (excluding sensitive information)
        console.log('[Email] Request data:', {
            hasReviewResult: !!reviewResult,
            blobUrl,
            fileName,
            submitterEmail,
            cityPlannerEmail,
            isCompliant: reviewResult?.isCompliant
        });

        if (!reviewResult || !blobUrl || !fileName || !submitterEmail || !cityPlannerEmail) {
            console.error('[Email] Missing required fields:', {
                hasReviewResult: !!reviewResult,
                hasBlobUrl: !!blobUrl,
                hasFileName: !!fileName,
                hasSubmitterEmail: !!submitterEmail,
                hasCityPlannerEmail: !!cityPlannerEmail
            });
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch the PDF from the Blob URL
        console.log('[Email] Fetching PDF from Blob URL:', blobUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        let pdfBuffer;
        try {
            const response = await fetch(blobUrl, {
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            pdfBuffer = Buffer.from(buffer);
            clearTimeout(timeoutId);

            console.log('[Email] Successfully fetched PDF from Blob:', {
                fileSize: pdfBuffer.length,
                fileSizeMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2)
            });
        } catch (fetchError) {
            console.error('[Email] Failed to fetch PDF from Blob:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch PDF from Blob: ' + (fetchError instanceof Error ? fetchError.message : 'Unknown error') },
                { status: 500 }
            );
        }

        const attachment = {
            filename: fileName,
            content: pdfBuffer,
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
            return NextResponse.json(
                { error: 'Failed to send email: ' + (sendError instanceof Error ? sendError.message : 'Unknown error') },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[Email] Error processing email request:', {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            { error: 'Failed to process email request: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
} 