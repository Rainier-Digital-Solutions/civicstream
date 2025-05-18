import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ReviewResult } from '@/lib/openai';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            reviewResult,
            pdfBuffer,
            fileName,
            submitterEmail,
            cityPlannerEmail,
        } = body;

        if (!reviewResult || !pdfBuffer || !fileName || !submitterEmail || !cityPlannerEmail) {
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

        if (reviewResult.isCompliant) {
            // Send to city planner if compliant
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@civicstream.com',
                to: cityPlannerEmail,
                subject: 'Compliant Architectural Plan for Review',
                html: reviewResult.cityPlannerEmailBody,
                attachments: [attachment],
            });
        } else {
            // Send back to submitter if non-compliant
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@civicstream.com',
                to: submitterEmail,
                subject: 'Architectural Plan Review Results - Action Required',
                html: reviewResult.submitterEmailBody,
                attachments: [attachment],
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { error: 'Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
} 