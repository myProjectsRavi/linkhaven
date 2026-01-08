/**
 * Eternal Library - ePub/PDF Book Export
 * 
 * CONCEPT: Convert a folder of bookmarks + their snapshots into a downloadable eBook
 * 
 * USE CASE:
 * "Download this Folder as a Book"
 * - Students compile research bookmarks into Kindle-readable format
 * - Researchers preserve article collection even if sites go down
 * - Professionals create offline reading packages
 * 
 * FORMATS:
 * - ePub: Universal eBook format (Kindle, iPad, etc.)
 * - PDF: Universal document format
 * 
 * TECHNICAL:
 * - Uses epub-gen-memory for ePub (client-side)
 * - Uses jsPDF for PDF generation
 * - Combines bookmark metadata + snapshot content
 * - Works 100% offline
 * 
 * MOAT: No competitor offers this feature
 */

import { Bookmark, Folder } from '../types';
import { getSnapshot, getSnapshotContent, getRichSnapshotHTML, PageSnapshot } from './snapshots';

// Book metadata configuration
export interface BookConfig {
    title: string;
    author: string;
    description?: string;
    coverImageUrl?: string;
    includeSnapshots: boolean;
    format: 'epub' | 'pdf';
}

// Chapter generated from bookmark
export interface BookChapter {
    title: string;
    url: string;
    content: string;
    createdAt: number;
}

/**
 * Collect bookmarks from a folder and its subfolders
 */
export function collectFolderBookmarks(
    folderId: string,
    folders: Folder[],
    bookmarks: Bookmark[],
    includeSubfolders: boolean = true
): Bookmark[] {
    const folderIds = new Set<string>([folderId]);

    if (includeSubfolders) {
        // Recursively collect subfolder IDs
        const collectChildren = (parentId: string) => {
            folders
                .filter(f => f.parentId === parentId)
                .forEach(f => {
                    folderIds.add(f.id);
                    collectChildren(f.id);
                });
        };
        collectChildren(folderId);
    }

    // Get bookmarks in these folders
    return bookmarks.filter(b => folderIds.has(b.folderId));
}

/**
 * Generate chapters from bookmarks
 */
async function generateChapters(
    bookmarks: Bookmark[],
    includeSnapshots: boolean
): Promise<BookChapter[]> {
    const chapters: BookChapter[] = [];

    for (const bookmark of bookmarks) {
        let content = '';

        if (includeSnapshots) {
            // Try to get snapshot content
            const snapshot = await getSnapshot(bookmark.id);
            if (snapshot) {
                if (snapshot.isRichSnapshot) {
                    // For rich snapshots, extract text from HTML
                    const html = await getRichSnapshotHTML(snapshot);
                    content = extractTextFromHTML(html);
                } else {
                    content = getSnapshotContent(snapshot);
                }
            }
        }

        // Fallback to description if no snapshot
        if (!content && bookmark.description) {
            content = bookmark.description;
        }

        // Create minimal content if still empty
        if (!content) {
            content = `Link: ${bookmark.url}\n\nNo offline content available.`;
        }

        chapters.push({
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            content,
            createdAt: bookmark.createdAt
        });
    }

    // Sort by creation date
    chapters.sort((a, b) => a.createdAt - b.createdAt);

    return chapters;
}

/**
 * Extract plain text from HTML
 */
function extractTextFromHTML(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script and style tags
    doc.querySelectorAll('script, style').forEach(el => el.remove());

    return doc.body.textContent?.trim() || '';
}

/**
 * Generate ePub using epub-gen-memory
 */
async function generateEpub(
    config: BookConfig,
    chapters: BookChapter[]
): Promise<Blob> {
    // Dynamic import to keep bundle small
    const { Epub } = await import('epub-gen-memory');

    const epubChapters = chapters.map((chapter, index) => ({
        title: chapter.title,
        content: `
            <h1>${escapeHtml(chapter.title)}</h1>
            <p><small>Source: <a href="${escapeHtml(chapter.url)}">${escapeHtml(chapter.url)}</a></small></p>
            <hr/>
            ${formatContentAsHtml(chapter.content)}
        `
    }));

    const epub = new Epub({
        title: config.title,
        author: config.author,
        description: config.description || `Collection of ${chapters.length} bookmarks from LinkHaven`,
        cover: config.coverImageUrl,
        content: epubChapters
    });

    const buffer = await epub.genEpub();
    return new Blob([buffer], { type: 'application/epub+zip' });
}

/**
 * Generate PDF using jsPDF
 */
async function generatePdf(
    config: BookConfig,
    chapters: BookChapter[]
): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    const maxLineWidth = pageWidth - margin * 2;

    // Title page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(config.title, pageWidth / 2, 60, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`by ${config.author}`, pageWidth / 2, 80, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`${chapters.length} Bookmarks • Created with LinkHaven`, pageWidth / 2, 100, { align: 'center' });

    // Table of contents
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', margin, 30);

    let tocY = 45;
    chapters.forEach((chapter, index) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const title = chapter.title.substring(0, 60) + (chapter.title.length > 60 ? '...' : '');
        doc.text(`${index + 1}. ${title}`, margin, tocY);
        tocY += lineHeight;

        if (tocY > pageHeight - 30) {
            doc.addPage();
            tocY = 30;
        }
    });

    // Chapters
    for (const chapter of chapters) {
        doc.addPage();

        // Chapter title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(chapter.title, maxLineWidth);
        doc.text(titleLines, margin, 30);

        // Source URL
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(`Source: ${chapter.url}`, margin, 30 + titleLines.length * 7 + 5);
        doc.setTextColor(0, 0, 0);

        // Content
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        let y = 30 + titleLines.length * 7 + 15;
        const contentLines = doc.splitTextToSize(chapter.content, maxLineWidth);

        for (const line of contentLines) {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, margin, y);
            y += lineHeight;
        }
    }

    return doc.output('blob');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format plain text content as HTML paragraphs
 */
function formatContentAsHtml(content: string): string {
    return content
        .split('\n\n')
        .map(para => `<p>${escapeHtml(para.trim())}</p>`)
        .join('\n');
}

/**
 * Export folder as eBook
 * 
 * Main entry point for Eternal Library feature
 * 
 * @param folderId - Folder to export
 * @param folders - All folders (for subfolder lookup)
 * @param bookmarks - All bookmarks
 * @param config - Book configuration
 * @returns Blob of the generated book file
 */
export async function exportFolderAsBook(
    folderId: string,
    folders: Folder[],
    bookmarks: Bookmark[],
    config: BookConfig
): Promise<Blob> {
    // Collect bookmarks from folder
    const folderBookmarks = collectFolderBookmarks(folderId, folders, bookmarks);

    if (folderBookmarks.length === 0) {
        throw new Error('No bookmarks found in this folder');
    }

    // Generate chapters
    const chapters = await generateChapters(folderBookmarks, config.includeSnapshots);

    // Generate book in requested format
    if (config.format === 'epub') {
        return generateEpub(config, chapters);
    } else {
        return generatePdf(config, chapters);
    }
}

/**
 * Download book file
 */
export function downloadBook(blob: Blob, filename: string, format: 'epub' | 'pdf'): void {
    const ext = format === 'epub' ? '.epub' : '.pdf';
    const fullFilename = filename.endsWith(ext) ? filename : `${filename}${ext}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFilename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
