/**
 * Naive Bayes Classifier - Client-side Zero-AI folder/tag suggestion
 * 
 * ALGORITHM:
 * Uses Multinomial Naive Bayes for text classification
 * 1. Tokenize existing bookmarks (remove stop words)
 * 2. Calculate P(folder|word) for each folder
 * 3. For new bookmark, multiply probabilities of its words
 * 4. Suggest folder with highest probability
 * 
 * MATH: P(folder|text) ∝ P(folder) × ∏ P(word|folder)
 * With Laplace smoothing to handle unseen words
 * 
 * MARKETING MOAT: "No AI. Just Pure Math. Your data never trains a bot."
 * 
 * COMPLEXITY:
 * - Training: O(n × m) where n = documents, m = avg words per doc
 * - Prediction: O(k × m) where k = number of folders
 * 
 * ZERO DEPENDENCIES - Pure JavaScript/TypeScript
 */

import { Bookmark, Folder } from '../types';

// Stop words to filter out (common words with no semantic meaning)
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
    'the', 'to', 'was', 'were', 'will', 'with', 'you', 'your', 'this',
    'they', 'we', 'our', 'have', 'been', 'not', 'but', 'what', 'all',
    'can', 'had', 'her', 'there', 'which', 'their', 'if', 'each',
    'about', 'how', 'up', 'out', 'them', 'then', 'she', 'many', 'some',
    'so', 'these', 'would', 'other', 'into', 'who', 'no', 'more',
    'www', 'http', 'https', 'com', 'org', 'net', 'html', 'php'
]);

/**
 * Tokenize and normalize text for classification
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation
        .split(/\s+/)                   // Split on whitespace
        .filter(word =>
            word.length >= 2 &&         // Min 2 chars
            word.length <= 30 &&        // Max 30 chars
            !STOP_WORDS.has(word) &&    // Remove stop words
            !/^\d+$/.test(word)         // Remove pure numbers
        );
}

/**
 * Extract domain from URL for additional context
 */
function extractDomainWords(url: string): string[] {
    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        // Split domain into words (e.g., "github.com" -> ["github"])
        return hostname
            .split('.')
            .filter(part => part.length > 2 && !['com', 'org', 'net', 'io', 'co'].includes(part));
    } catch {
        return [];
    }
}

/**
 * Naive Bayes Classifier Model
 * Stores word frequencies per folder for probability calculation
 */
export interface NaiveBayesModel {
    // Word counts per folder: folderId -> word -> count
    folderWordCounts: Map<string, Map<string, number>>;
    // Total words per folder
    folderTotalWords: Map<string, number>;
    // Document count per folder (for prior probability)
    folderDocCounts: Map<string, number>;
    // Total documents
    totalDocs: number;
    // Complete vocabulary
    vocabulary: Set<string>;
    // Folder names for display
    folderNames: Map<string, string>;
}

/**
 * Train classifier on existing bookmarks
 * 
 * @param bookmarks - All user bookmarks
 * @param folders - All user folders
 * @returns Trained model
 */
export function trainClassifier(
    bookmarks: Bookmark[],
    folders: Folder[]
): NaiveBayesModel {
    const model: NaiveBayesModel = {
        folderWordCounts: new Map(),
        folderTotalWords: new Map(),
        folderDocCounts: new Map(),
        totalDocs: 0,
        vocabulary: new Set(),
        folderNames: new Map()
    };

    // Initialize folder names
    for (const folder of folders) {
        model.folderNames.set(folder.id, folder.name);
    }

    // Process each bookmark
    for (const bookmark of bookmarks) {
        const folderId = bookmark.folderId;

        // Combine title, description, URL domain, and tags for training
        const textParts = [
            bookmark.title || '',
            bookmark.description || '',
            ...extractDomainWords(bookmark.url),
            ...(bookmark.tags || [])
        ];
        const words = tokenize(textParts.join(' '));

        if (words.length === 0) continue;

        // Initialize folder if not seen
        if (!model.folderWordCounts.has(folderId)) {
            model.folderWordCounts.set(folderId, new Map());
            model.folderTotalWords.set(folderId, 0);
            model.folderDocCounts.set(folderId, 0);
        }

        // Count words
        const wordCounts = model.folderWordCounts.get(folderId)!;
        for (const word of words) {
            model.vocabulary.add(word);
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            model.folderTotalWords.set(
                folderId,
                model.folderTotalWords.get(folderId)! + 1
            );
        }

        // Count document
        model.folderDocCounts.set(
            folderId,
            model.folderDocCounts.get(folderId)! + 1
        );
        model.totalDocs++;
    }

    return model;
}

/**
 * Suggestion result with confidence score
 */
export interface FolderSuggestion {
    folderId: string;
    folderName: string;
    confidence: number; // 0-100
    logProbability: number;
}

/**
 * Suggest folders for new bookmark text
 * 
 * @param text - Title + description + URL of new bookmark
 * @param model - Trained classifier model
 * @param topN - Number of suggestions to return
 * @returns Array of folder suggestions with confidence scores
 */
export function suggestFolders(
    text: string,
    url: string,
    model: NaiveBayesModel,
    topN: number = 3
): FolderSuggestion[] {
    if (model.totalDocs === 0 || model.vocabulary.size === 0) {
        return [];
    }

    // Tokenize input
    const inputParts = [text, ...extractDomainWords(url)];
    const words = tokenize(inputParts.join(' '));

    if (words.length === 0) {
        return [];
    }

    const vocabSize = model.vocabulary.size;
    const scores: FolderSuggestion[] = [];

    // Calculate log probability for each folder
    for (const [folderId, docCount] of model.folderDocCounts) {
        // Prior probability: P(folder) = docs in folder / total docs
        const prior = docCount / model.totalDocs;
        let logProb = Math.log(prior);

        const wordCounts = model.folderWordCounts.get(folderId)!;
        const totalWords = model.folderTotalWords.get(folderId)!;

        // Likelihood: P(word|folder) for each word
        for (const word of words) {
            // Laplace smoothing: (count + 1) / (total + vocabSize)
            const count = wordCounts.get(word) || 0;
            const prob = (count + 1) / (totalWords + vocabSize);
            logProb += Math.log(prob);
        }

        scores.push({
            folderId,
            folderName: model.folderNames.get(folderId) || 'Unknown',
            confidence: 0, // Will calculate after normalization
            logProbability: logProb
        });
    }

    // Sort by probability (highest first)
    scores.sort((a, b) => b.logProbability - a.logProbability);

    // Normalize to confidence scores (0-100)
    // Use softmax-like normalization on top results
    const topScores = scores.slice(0, topN);
    if (topScores.length > 0) {
        const maxLogProb = topScores[0].logProbability;

        // Calculate normalized scores
        let sumExp = 0;
        for (const score of topScores) {
            // Subtract max to prevent overflow
            sumExp += Math.exp(score.logProbability - maxLogProb);
        }

        for (const score of topScores) {
            const expScore = Math.exp(score.logProbability - maxLogProb);
            score.confidence = Math.round((expScore / sumExp) * 100);
        }
    }

    return topScores;
}

/**
 * Suggest tags based on similar bookmarks
 * Uses folder context to suggest tags commonly used in that context
 * 
 * @param folderId - Target folder
 * @param model - Trained model
 * @param existingTags - Tags already on the bookmark
 * @param bookmarks - All bookmarks to analyze
 * @returns Suggested tags with confidence
 */
export interface TagSuggestion {
    tag: string;
    confidence: number;
    frequency: number;
}

export function suggestTags(
    folderId: string,
    existingTags: string[],
    bookmarks: Bookmark[],
    topN: number = 5
): TagSuggestion[] {
    // Get all bookmarks in the same folder
    const folderBookmarks = bookmarks.filter(b => b.folderId === folderId);

    if (folderBookmarks.length === 0) {
        return [];
    }

    // Count tag frequency in folder
    const tagCounts = new Map<string, number>();
    const existingSet = new Set(existingTags.map(t => t.toLowerCase()));

    for (const bookmark of folderBookmarks) {
        for (const tag of bookmark.tags || []) {
            const lowerTag = tag.toLowerCase();
            if (!existingSet.has(lowerTag)) {
                tagCounts.set(lowerTag, (tagCounts.get(lowerTag) || 0) + 1);
            }
        }
    }

    // Convert to suggestions
    const suggestions: TagSuggestion[] = [];
    const maxCount = Math.max(...tagCounts.values(), 1);

    for (const [tag, count] of tagCounts) {
        suggestions.push({
            tag,
            confidence: Math.round((count / maxCount) * 100),
            frequency: count
        });
    }

    // Sort by frequency and return top N
    return suggestions
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, topN);
}

/**
 * Export model to JSON for persistence
 */
export function exportModel(model: NaiveBayesModel): string {
    const serializable = {
        folderWordCounts: Array.from(model.folderWordCounts.entries()).map(
            ([k, v]) => [k, Array.from(v.entries())]
        ),
        folderTotalWords: Array.from(model.folderTotalWords.entries()),
        folderDocCounts: Array.from(model.folderDocCounts.entries()),
        totalDocs: model.totalDocs,
        vocabulary: Array.from(model.vocabulary),
        folderNames: Array.from(model.folderNames.entries())
    };
    return JSON.stringify(serializable);
}

/**
 * Import model from JSON
 */
export function importModel(json: string): NaiveBayesModel {
    const data = JSON.parse(json);
    return {
        folderWordCounts: new Map(
            data.folderWordCounts.map(([k, v]: [string, [string, number][]]) =>
                [k, new Map(v)]
            )
        ),
        folderTotalWords: new Map(data.folderTotalWords),
        folderDocCounts: new Map(data.folderDocCounts),
        totalDocs: data.totalDocs,
        vocabulary: new Set(data.vocabulary),
        folderNames: new Map(data.folderNames)
    };
}
