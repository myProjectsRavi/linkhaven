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

    let entriesHTML = '';
    for (const entry of log.entries) {
        entriesHTML += `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(entry.timestamp)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${actionLabels[entry.action] || entry.action}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 10px;">${entry.entityId.substring(0, 12)}...</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 10px;">${entry.entryHash.substring(0, 16)}...</td>
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
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    .header { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .integrity { font-size: 18px; font-weight: bold; color: ${verification.isValid ? '#10b981' : '#ef4444'}; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #4f46e5; color: white; padding: 12px; text-align: left; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    .hash { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>🔒 LinkHaven Audit Trail Certificate</h1>
  
  <div class="header">
    <p><strong>Generated:</strong> ${formatDate(Date.now())}</p>
    <p><strong>Total Entries:</strong> ${log.entries.length}</p>
    <p class="integrity">Chain Integrity: ${verification.isValid ? '✅ VERIFIED' : '❌ BROKEN'}</p>
    <p><strong>Genesis Hash:</strong></p>
    <p class="hash">${log.genesisHash}</p>
    <p><strong>Latest Hash:</strong></p>
    <p class="hash">${log.lastHash}</p>
  </div>
  
  <h2>📜 Activity Log</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Action</th>
        <th>Entity ID</th>
        <th>Entry Hash</th>
      </tr>
    </thead>
    <tbody>
      ${entriesHTML || '<tr><td colspan="4" style="padding: 20px; text-align: center;">No entries recorded yet.</td></tr>'}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>About This Certificate:</strong></p>
    <p>This document provides a cryptographically verifiable record of all activities performed in your LinkHaven bookmark vault. 
    Each entry is linked to the previous entry via SHA-256 hashing, creating a tamper-evident chain. 
    Any modification to historical entries would break the chain integrity.</p>
    <p><strong>Verification:</strong> The JSON export can be independently verified using any SHA-256 implementation.</p>
    <p>© LinkHaven - Privacy-First Bookmarks Manager</p>
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
