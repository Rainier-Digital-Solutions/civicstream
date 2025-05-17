import { PDFDocument } from 'pdf-lib';
import { PDFPageProxy } from 'pdfjs-dist';

const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_PAGES_PER_CHUNK = 5; // Process 5 pages at a time

export interface PDFChunk {
    pages: number[];
    content: string;
    base64: string;
}

export async function chunkPDF(pdfBuffer: Buffer): Promise<PDFChunk[]> {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdfDoc = await PDFDocument.load(uint8Array);
    const totalPages = pdfDoc.getPageCount();
    const chunks: PDFChunk[] = [];

    // Process pages in chunks
    for (let i = 0; i < totalPages; i += MAX_PAGES_PER_CHUNK) {
        const endPage = Math.min(i + MAX_PAGES_PER_CHUNK, totalPages);
        const pageNumbers = Array.from({ length: endPage - i }, (_, idx) => i + idx + 1);

        // Create a new PDF with just these pages
        const chunkDoc = await PDFDocument.create();
        for (const pageNum of pageNumbers) {
            const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum - 1]);
            chunkDoc.addPage(copiedPage);
        }

        // Convert to base64
        const chunkBytes = await chunkDoc.save();
        const base64 = Buffer.from(chunkBytes).toString('base64');

        chunks.push({
            pages: pageNumbers,
            content: `Pages ${pageNumbers.join(', ')}`,
            base64
        });
    }

    return chunks;
}

export async function processPDFChunks(chunks: PDFChunk[]): Promise<string> {
    let fullContent = '';

    for (const chunk of chunks) {
        // Here you would process each chunk with OpenAI
        // For now, we'll just concatenate the content
        fullContent += chunk.content + '\n';
    }

    return fullContent;
}

export async function validatePDF(file: File): Promise<boolean> {
    try {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        await PDFDocument.load(uint8Array);
        return true;
    } catch (error) {
        console.error('PDF validation error:', error);
        return false;
    }
}

export function getFileSizeInMB(file: File): number {
    return file.size / (1024 * 1024);
} 