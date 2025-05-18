import { PDFDocument } from 'pdf-lib';

const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_PAGES_PER_CHUNK = 5; // Process 5 pages at a time
const MAX_TOKENS_PER_CHUNK = 1500; // Maximum tokens per chunk

// Simple token counting function
function countTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
}

export interface PDFChunk {
    pages: number[];
    content: string;
    base64: string;
    locationInfo?: LocationInfo;
}

export interface LocationInfo {
    address: string;
    parcelNumber: string;
}

export async function extractLocationInfo(pageText: string): Promise<LocationInfo | null> {
    // Look for address and parcel number in common formats
    const addrMatch = pageText.match(/Address:\s*([^\n]+)/i) ||
        pageText.match(/Location:\s*([^\n]+)/i) ||
        pageText.match(/Site Address:\s*([^\n]+)/i);

    const parcelMatch = pageText.match(/Parcel\s*#?:\s*([^\s\n]+)/i) ||
        pageText.match(/Parcel ID:\s*([^\s\n]+)/i) ||
        pageText.match(/Parcel Number:\s*([^\s\n]+)/i);

    if (addrMatch?.[1] && parcelMatch?.[1]) {
        return {
            address: addrMatch[1].trim(),
            parcelNumber: parcelMatch[1].trim()
        };
    }

    return null;
}

export async function extractPdfPages(file: File): Promise<{ text: string; pageNumber: number }[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages: { text: string; pageNumber: number }[] = [];

    // For now, we'll just extract page numbers since text extraction is complex
    // You might want to use pdf.js for text extraction if needed
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        pages.push({
            text: `Page ${i + 1}`, // Placeholder text
            pageNumber: i + 1
        });
    }

    return pages;
}

export async function chunkPagesByTokens(pages: { text: string; pageNumber: number }[]): Promise<PDFChunk[]> {
    const chunks: PDFChunk[] = [];
    let currentChunk: { text: string; pageNumbers: number[] } = { text: '', pageNumbers: [] };
    let locationInfo: LocationInfo | null = null;

    for (const page of pages) {
        // Try to extract location info from the first page
        if (!locationInfo) {
            locationInfo = await extractLocationInfo(page.text);
        }

        const tentativeText = currentChunk.text ?
            `${currentChunk.text}\n\n${page.text}` :
            page.text;

        const tokenCount = countTokens(tentativeText);

        if (tokenCount > MAX_TOKENS_PER_CHUNK && currentChunk.text) {
            // Save current chunk and start a new one
            chunks.push({
                pages: currentChunk.pageNumbers,
                content: currentChunk.text,
                base64: '', // Will be filled in later
                locationInfo: locationInfo || undefined
            });

            currentChunk = {
                text: page.text,
                pageNumbers: [page.pageNumber]
            };
        } else {
            currentChunk.text = tentativeText;
            currentChunk.pageNumbers.push(page.pageNumber);
        }
    }

    // Add the last chunk if it has content
    if (currentChunk.text) {
        chunks.push({
            pages: currentChunk.pageNumbers,
            content: currentChunk.text,
            base64: '', // Will be filled in later
            locationInfo: locationInfo || undefined
        });
    }

    return chunks;
}

export async function chunkPDF(input: File | Buffer): Promise<PDFChunk[]> {
    try {
        const fileInfo = input instanceof File ? {
            fileName: input.name,
            fileSize: input.size,
            fileSizeMB: (input.size / (1024 * 1024)).toFixed(2)
        } : {
            fileName: 'buffer.pdf',
            fileSize: input.length,
            fileSizeMB: (input.length / (1024 * 1024)).toFixed(2)
        };

        console.log('[PDF] Starting chunking process:', fileInfo);

        // Get array buffer from input
        const arrayBuffer = input instanceof File ?
            await input.arrayBuffer() :
            input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdfDoc = await PDFDocument.load(uint8Array);

        // Extract pages
        const pages = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => ({
            text: `Page ${i + 1}`,
            pageNumber: i + 1
        }));
        console.log('[PDF] Extracted', pages.length, 'pages');

        // Chunk by tokens
        const textChunks = await chunkPagesByTokens(pages);
        console.log('[PDF] Created', textChunks.length, 'text chunks');

        // Create PDF chunks for each text chunk
        const chunks: PDFChunk[] = [];
        for (const textChunk of textChunks) {
            try {
                // Create a new PDF with just these pages
                const chunkDoc = await PDFDocument.create();
                for (const pageNum of textChunk.pages) {
                    const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum - 1]);
                    chunkDoc.addPage(copiedPage);
                }

                // Convert to base64
                const chunkBytes = await chunkDoc.save();
                const base64 = btoa(Array.from(new Uint8Array(chunkBytes))
                    .map(byte => String.fromCharCode(byte))
                    .join(''));

                console.log(`[PDF] Successfully processed chunk for pages ${textChunk.pages.join(', ')}:`, {
                    chunkSize: chunkBytes.length,
                    chunkSizeMB: (chunkBytes.length / (1024 * 1024)).toFixed(2)
                });

                chunks.push({
                    ...textChunk,
                    base64
                });
            } catch (chunkError) {
                console.error(`[PDF] Error processing chunk for pages ${textChunk.pages.join(', ')}:`, chunkError);
                throw new Error(`Failed to process PDF chunk for pages ${textChunk.pages.join(', ')}`);
            }
        }

        console.log('[PDF] Chunking completed:', {
            totalChunks: chunks.length,
            totalPages: pages.length
        });

        return chunks;
    } catch (error) {
        console.error('[PDF] Error in chunkPDF:', error);
        throw new Error('Failed to chunk PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

export async function validatePDF(file: File): Promise<boolean> {
    try {
        console.log('[PDF] Validating PDF:', {
            fileName: file.name,
            fileSize: file.size,
            fileSizeMB: (file.size / (1024 * 1024)).toFixed(2)
        });

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await PDFDocument.load(uint8Array);

        console.log('[PDF] PDF validation successful');
        return true;
    } catch (error) {
        console.error('[PDF] PDF validation error:', error);
        return false;
    }
}

export function getFileSizeInMB(file: File): number {
    return file.size / (1024 * 1024);
} 