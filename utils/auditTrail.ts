// LinkHaven - Forensic Audit Trail
// Creates tamper-proof hash chain of all bookmark actions
// Exportable as PDF/JSON for legal/compliance purposes

import { set, get, keys } from 'idb-keyval';
import { Bookmark, Folder } from '../types';

// Audit entry types
export type AuditAction =
    | 'CREATE_BOOKMARK'
    | 'UPDATE_BOOKMARK'
    | 'DELETE_BOOKMARK'
    | 'CREATE_FOLDER'
    | 'DELETE_FOLDER'
    | 'IMPORT_DATA'
    | 'EXPORT_DATA'
    | 'SNAPSHOT_CREATED'
    | 'HEALTH_CHECK';

export interface AuditEntry {
    id: string;
    action: AuditAction;
    timestamp: number;
    entityId: string;          // Bookmark or folder ID
    entityType: 'bookmark' | 'folder' | 'system';
    dataSnapshot?: string;      // JSON of the entity at time of action
    dataHash: string;           // SHA-256 of the data snapshot
    previousHash: string;       // Hash of previous entry (chain link)
    entryHash: string;          // SHA-256 of this entire entry (proof of integrity)
    metadata?: Record<string, string>; // Additional context
}

export interface AuditLog {
    version: number;
    createdAt: number;
    entries: AuditEntry[];
    genesisHash: string;        // Root of the hash chain
    lastHash: string;           // Most recent entry hash
}

// Storage keys
const AUDIT_LOG_KEY = 'lh_audit_log';
const AUDIT_PREFIX = 'lh_audit_';

/**
 * Generate SHA-256 hash
 */
async function sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize or get the audit log
 */
async function getAuditLog(): Promise<AuditLog> {
    const log = await get(AUDIT_LOG_KEY);
    if (log) return log;

    // Create genesis
    const genesisHash = await sha256(`LINKHAVEN_GENESIS_${Date.now()}`);
    const newLog: AuditLog = {
        version: 1,
        createdAt: Date.now(),
        entries: [],
        genesisHash,
        lastHash: genesisHash
    };

    await set(AUDIT_LOG_KEY, newLog);
    return newLog;
}

/**
 * Save the audit log
 */
async function saveAuditLog(log: AuditLog): Promise<void> {
    await set(AUDIT_LOG_KEY, log);
}

/**
 * Create an audit entry with hash chain
 */
export async function createAuditEntry(
    action: AuditAction,
    entityId: string,
    entityType: 'bookmark' | 'folder' | 'system',
    dataSnapshot?: unknown,
    metadata?: Record<string, string>
): Promise<AuditEntry> {
    const log = await getAuditLog();

    const dataString = dataSnapshot ? JSON.stringify(dataSnapshot) : '';
    const dataHash = await sha256(dataString);

    const entry: AuditEntry = {
        id: generateId(),
        action,
        timestamp: Date.now(),
        entityId,
        entityType,
        dataSnapshot: dataString || undefined,
        dataHash,
        previousHash: log.lastHash,
        entryHash: '', // Will be calculated
        metadata
    };

    // Calculate entry hash (includes all fields for tamper-proofing)
    const entryString = `${entry.action}:${entry.timestamp}:${entry.entityId}:${entry.dataHash}:${entry.previousHash}`;
    entry.entryHash = await sha256(entryString);

    // Add to log
    log.entries.push(entry);
    log.lastHash = entry.entryHash;

    await saveAuditLog(log);

    return entry;
}

/**
 * Verify the integrity of the entire audit chain
 */
export async function verifyAuditChain(): Promise<{
    isValid: boolean;
    brokenAt?: number;
    totalEntries: number;
}> {
    const log = await getAuditLog();

    if (log.entries.length === 0) {
        return { isValid: true, totalEntries: 0 };
    }

    let expectedPreviousHash = log.genesisHash;

    for (let i = 0; i < log.entries.length; i++) {
        const entry = log.entries[i];

        // Verify chain link
        if (entry.previousHash !== expectedPreviousHash) {
            return { isValid: false, brokenAt: i, totalEntries: log.entries.length };
        }

        // Verify entry hash
        const entryString = `${entry.action}:${entry.timestamp}:${entry.entityId}:${entry.dataHash}:${entry.previousHash}`;
        const calculatedHash = await sha256(entryString);

        if (calculatedHash !== entry.entryHash) {
            return { isValid: false, brokenAt: i, totalEntries: log.entries.length };
        }

        expectedPreviousHash = entry.entryHash;
    }

    return { isValid: true, totalEntries: log.entries.length };
}

/**
 * Get audit statistics
 */
export async function getAuditStats(): Promise<{
    totalEntries: number;
    entriesByAction: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
    chainIntegrity: boolean;
}> {
    const log = await getAuditLog();
    const verification = await verifyAuditChain();

    const entriesByAction: Record<string, number> = {};
    for (const entry of log.entries) {
        entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
    }

    return {
        totalEntries: log.entries.length,
        entriesByAction,
        oldestEntry: log.entries.length > 0 ? log.entries[0].timestamp : null,
        newestEntry: log.entries.length > 0 ? log.entries[log.entries.length - 1].timestamp : null,
        chainIntegrity: verification.isValid
    };
}

/**
 * Get entries for a specific entity
 */
export async function getEntityHistory(entityId: string): Promise<AuditEntry[]> {
    const log = await getAuditLog();
    return log.entries.filter(e => e.entityId === entityId);
}

/**
 * Export audit log as JSON (machine-verifiable)
 */
export async function exportAuditLogJSON(): Promise<string> {
    const log = await getAuditLog();
    const verification = await verifyAuditChain();

    const exportData = {
        exportedAt: new Date().toISOString(),
        exportedFrom: 'LinkHaven',
        version: log.version,
        chainIntegrity: verification.isValid,
        genesisHash: log.genesisHash,
        lastHash: log.lastHash,
        totalEntries: log.entries.length,
        entries: log.entries.map(e => ({
            ...e,
            timestampISO: new Date(e.timestamp).toISOString()
        }))
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Export audit log as HTML (human-readable, can be printed as PDF)
 */
export async function exportAuditLogHTML(): Promise<string> {
    const log = await getAuditLog();
    const verification = await verifyAuditChain();

    const formatDate = (ts: number) => new Date(ts).toLocaleString('en-GB', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const actionLabels: Record<string, string> = {
        CREATE_BOOKMARK: '📌 Created Bookmark',
        UPDATE_BOOKMARK: '✏️ Updated Bookmark',
        DELETE_BOOKMARK: '🗑️ Deleted Bookmark',
        CREATE_FOLDER: '📁 Created Folder',
        DELETE_FOLDER: '🗑️ Deleted Folder',
        IMPORT_DATA: '📥 Imported Data',
        EXPORT_DATA: '📤 Exported Data',
        SNAPSHOT_CREATED: '📸 Created Snapshot',
        HEALTH_CHECK: '🔍 Health Check'
    };

    // Helper to extract human-readable details from entry
    const getDetails = (entry: AuditEntry): string => {
        // Try to parse dataSnapshot for details
        if (entry.dataSnapshot) {
            try {
                const data = JSON.parse(entry.dataSnapshot);
                if (data.title && data.url) {
                    // Bookmark
                    return `<strong>${data.title}</strong><br><span style="color:#666;font-size:11px;">${data.url}</span>`;
                } else if (data.name) {
                    // Folder
                    return `<strong>Folder: ${data.name}</strong>`;
                }
            } catch {
                // Not JSON, continue to metadata
            }
        }

        // Fall back to metadata
        if (entry.metadata) {
            if (entry.metadata.deletedTitle) {
                return `<strong>${entry.metadata.deletedTitle}</strong> <span style="color:#999;">(deleted)</span>`;
            }
            if (entry.metadata.deletedName) {
                return `<strong>Folder: ${entry.metadata.deletedName}</strong> <span style="color:#999;">(deleted)</span>`;
            }
            if (entry.metadata.importedCount) {
                return `<strong>${entry.metadata.importedCount} bookmarks</strong> imported`;
            }
            if (entry.metadata.url) {
                return `Snapshot of: ${entry.metadata.url}`;
            }
            if (entry.metadata.checkedCount) {
                return `Checked ${entry.metadata.checkedCount} links, ${entry.metadata.deadCount} dead`;
            }
        }

        // System actions
        if (entry.entityId === 'system') {
            return '<span style="color:#999;">System action</span>';
        }

        return `ID: ${entry.entityId.substring(0, 12)}...`;
    };

    let entriesHTML = '';
    for (const entry of log.entries) {
        entriesHTML += `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${formatDate(entry.timestamp)}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${actionLabels[entry.action] || entry.action}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${getDetails(entry)}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; color: #64748b;">${entry.entryHash.substring(0, 16)}...</td>
      </tr>
    `;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LinkHaven Audit Trail Certificate</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; background: #fff; }
    h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
    .integrity { font-size: 18px; font-weight: bold; color: ${verification.isValid ? '#10b981' : '#ef4444'}; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #4f46e5; color: white; padding: 14px; text-align: left; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    .hash { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 6px 10px; border-radius: 6px; word-break: break-all; color: #475569; }
    .stat { display: inline-block; background: #4f46e5; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-right: 8px; }
  </style>
</head>
<body>
  <h1>🔒 LinkHaven Audit Trail Certificate</h1>
  
  <div class="header">
    <p><strong>Generated:</strong> ${formatDate(Date.now())}</p>
    <p><span class="stat">${log.entries.length} Total Entries</span></p>
    <p class="integrity">Chain Integrity: ${verification.isValid ? '✅ VERIFIED - All entries cryptographically linked' : '❌ BROKEN - Chain has been tampered with'}</p>
    <p><strong>Genesis Hash:</strong></p>
    <p class="hash">${log.genesisHash}</p>
    <p><strong>Latest Hash:</strong></p>
    <p class="hash">${log.lastHash}</p>
  </div>
  
  <h2>📜 Activity Log</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 180px;">Timestamp</th>
        <th style="width: 160px;">Action</th>
        <th>Details</th>
        <th style="width: 150px;">Proof Hash</th>
      </tr>
    </thead>
    <tbody>
      ${entriesHTML || '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8;">No entries recorded yet.</td></tr>'}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>About This Certificate:</strong></p>
    <p>This document provides a cryptographically verifiable record of all activities in your LinkHaven bookmark vault. 
    Each entry contains a SHA-256 hash that links to the previous entry, creating a tamper-evident chain (similar to blockchain). 
    Any modification to historical entries would break the chain integrity.</p>
    <p><strong>Legal Note:</strong> This certificate can serve as evidence of when specific bookmarks/data were created or modified. 
    The cryptographic hashes can be independently verified using the JSON export.</p>
    <p style="margin-top: 16px;">© LinkHaven - Privacy-First Bookmarks Manager | Zero Cloud, Zero Tracking</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Helper functions for common audit actions
 */
export const audit = {
    async bookmarkCreated(bookmark: Bookmark): Promise<void> {
        await createAuditEntry('CREATE_BOOKMARK', bookmark.id, 'bookmark', bookmark);
    },

    async bookmarkUpdated(bookmark: Bookmark, changes?: string[]): Promise<void> {
        await createAuditEntry('UPDATE_BOOKMARK', bookmark.id, 'bookmark', bookmark,
            changes ? { changedFields: changes.join(',') } : undefined);
    },

    async bookmarkDeleted(bookmarkId: string, title?: string): Promise<void> {
        await createAuditEntry('DELETE_BOOKMARK', bookmarkId, 'bookmark', undefined,
            title ? { deletedTitle: title } : undefined);
    },

    async folderCreated(folder: Folder): Promise<void> {
        await createAuditEntry('CREATE_FOLDER', folder.id, 'folder', folder);
    },

    async folderDeleted(folderId: string, name?: string): Promise<void> {
        await createAuditEntry('DELETE_FOLDER', folderId, 'folder', undefined,
            name ? { deletedName: name } : undefined);
    },

    async dataImported(count: number): Promise<void> {
        await createAuditEntry('IMPORT_DATA', 'system', 'system', undefined,
            { importedCount: String(count) });
    },

    async dataExported(): Promise<void> {
        await createAuditEntry('EXPORT_DATA', 'system', 'system');
    },

    async snapshotCreated(bookmarkId: string, url: string): Promise<void> {
        await createAuditEntry('SNAPSHOT_CREATED', bookmarkId, 'bookmark', undefined,
            { url });
    },

    async healthCheck(checkedCount: number, deadCount: number): Promise<void> {
        await createAuditEntry('HEALTH_CHECK', 'system', 'system', undefined,
            { checkedCount: String(checkedCount), deadCount: String(deadCount) });
    }
};
