import { put, list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb'
        }
    }
};

// Function to handle chunked uploads
async function handleChunkedUpload(formData: FormData) {
    const index = Number(formData.get('index'));
    const total = Number(formData.get('total'));
    const fileName = formData.get('fileName') as string;
    const fileId = formData.get('fileId') as string;
    const chunk = formData.get('chunk') as File;
    const isFinalChunk = index === total - 1;

    console.log(`Processing chunk ${index + 1}/${total} for file: ${fileName}, ID: ${fileId}`);

    if (!chunk || typeof index !== 'number' || typeof total !== 'number' || !fileName || !fileId) {
        return NextResponse.json(
            { error: 'Missing required chunking parameters' },
            { status: 400 }
        );
    }

    try {
        // Upload the chunk with a temporary name
        const chunkName = `${fileId}_${index.toString().padStart(5, '0')}.chunk`;
        const blob = await put(chunkName, chunk, {
            access: 'public',
            addRandomSuffix: false
        });

        // If this is the final chunk, save the metadata for reassembly
        if (isFinalChunk) {
            const metadataBlob = await put(`${fileId}_meta.json`, JSON.stringify({
                fileName,
                totalChunks: total,
                contentType: chunk.type,
                timestamp: new Date().toISOString()
            }), {
                access: 'public',
                addRandomSuffix: false
            });
        }

        return NextResponse.json({
            success: true,
            url: blob.url,
            isFinalChunk
        });
    } catch (error) {
        console.error(`Error uploading chunk ${index}:`, error);
        return NextResponse.json(
            { error: `Failed to upload chunk ${index}` },
            { status: 500 }
        );
    }
}

// Function to handle reassembling chunks
async function reassembleChunks(fileId: string) {
    console.log(`Reassembling chunks for file ID: ${fileId}`);

    try {
        // Get metadata for the file by listing the blobs
        const metadataFileName = `${fileId}_meta.json`;
        let metadataContent;

        console.log('Listing blobs to find metadata file');
        const { blobs } = await list({
            prefix: `${fileId}_`,
        });

        const metadataBlob = blobs.find(blob => blob.pathname === metadataFileName);
        if (!metadataBlob) {
            throw new Error('Could not find metadata file');
        }

        console.log('Found metadata file:', metadataBlob.url);
        const metadataResponse = await fetch(metadataBlob.url);
        if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`);
        }

        metadataContent = await metadataResponse.json();

        const { fileName, totalChunks, contentType } = metadataContent;

        console.log(`Reassembling ${totalChunks} chunks for: ${fileName}`);

        // Filter out the metadata file and sort chunks by index
        const chunkBlobs = blobs
            .filter(blob => blob.pathname.endsWith('.chunk'))
            .sort((a, b) => {
                const indexA = parseInt(a.pathname.split('_')[1].split('.')[0]);
                const indexB = parseInt(b.pathname.split('_')[1].split('.')[0]);
                return indexA - indexB;
            });

        if (chunkBlobs.length !== totalChunks) {
            throw new Error(`Expected ${totalChunks} chunks but found ${chunkBlobs.length}`);
        }

        // Download and combine all chunks
        const chunks: ArrayBuffer[] = [];
        for (const chunkBlob of chunkBlobs) {
            const response = await fetch(chunkBlob.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch chunk: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            chunks.push(buffer);
        }

        // Combine all chunks into a single file
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        const combinedBuffer = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            combinedBuffer.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }

        // Create a File object from the combined buffer
        const combinedFile = new File([combinedBuffer], fileName, { type: contentType });

        // Upload the complete file
        const finalBlob = await put(fileName, combinedFile, {
            access: 'public',
            addRandomSuffix: true
        });

        // Clean up temporary chunk files (async)
        Promise.all([
            ...chunkBlobs.map(blob => del(blob.url)),
            metadataBlob ? del(metadataBlob.url) : Promise.resolve()
        ]).catch(error => {
            console.error('Error cleaning up temporary chunks:', error);
        });

        return { url: finalBlob.url, fileName: finalBlob.pathname };
    } catch (error) {
        console.error('Error reassembling chunks:', error);
        throw error;
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        // Check if this is a chunked upload
        if (formData.has('chunk') && formData.has('index') && formData.has('total')) {
            return handleChunkedUpload(formData);
        }

        // Check if this is a reassembly request
        if (formData.has('fileId') && formData.has('action') && formData.get('action') === 'reassemble') {
            const fileId = formData.get('fileId') as string;
            try {
                const { url, fileName } = await reassembleChunks(fileId);
                return NextResponse.json({
                    url,
                    fileName
                });
            } catch (error) {
                return NextResponse.json(
                    { error: 'Failed to reassemble chunks: ' + (error instanceof Error ? error.message : 'Unknown error') },
                    { status: 500 }
                );
            }
        }

        // Handle regular file upload
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate content type
        if (!file.type.startsWith('application/pdf')) {
            return NextResponse.json(
                { error: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        // Upload the file
        const blob = await put(file.name, file, {
            access: 'public',
            addRandomSuffix: true
        });

        return NextResponse.json({
            url: blob.url
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
} 