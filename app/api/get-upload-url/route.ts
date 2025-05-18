import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { filename, contentType } = await req.json();

        const blob = await put(filename, Buffer.from([]), {
            access: 'public',
            contentType,
        });

        return NextResponse.json(blob);
    } catch (error) {
        console.error('Error generating upload URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate upload URL' },
            { status: 500 }
        );
    }
} 