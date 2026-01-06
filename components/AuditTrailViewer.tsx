import React, { useState, useEffect } from 'react';
import { Shield, Download, FileText, FileJson, Check, Loader, AlertTriangle, RefreshCw } from 'lucide-react';
import {
    getAuditStats,
    verifyAuditChain,
    exportAuditLogJSON,
    exportAuditLogHTML
} from '../utils/auditTrail';

interface AuditTrailViewerProps {
    onClose: () => void;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({ onClose }) => {
    const [stats, setStats] = useState<{
        totalEntries: number;
        entriesByAction: Record<string, number>;
        oldestEntry: number | null;
        newestEntry: number | null;
        chainIntegrity: boolean;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setIsLoading(true);
        const data = await getAuditStats();
        setStats(data);
        setIsLoading(false);
    };

    const handleExportJSON = async () => {
        setIsExporting(true);
        try {
            const json = await exportAuditLogJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `linkhaven_audit_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
        setIsExporting(false);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const html = await exportAuditLogHTML();
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `linkhaven_audit_certificate_${new Date().toISOString().slice(0, 10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Open in new tab for printing
            window.open(url, '_blank');
        } catch (e) {
            console.error('Export failed:', e);
        }
        setIsExporting(false);
    };

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const actionLabels: Record<string, string> = {
        CREATE_BOOKMARK: 'Created Bookmarks',
        UPDATE_BOOKMARK: 'Updated Bookmarks',
        DELETE_BOOKMARK: 'Deleted Bookmarks',
        CREATE_FOLDER: 'Created Folders',
        DELETE_FOLDER: 'Deleted Folders',
        IMPORT_DATA: 'Data Imports',
        EXPORT_DATA: 'Data Exports',
        SNAPSHOT_CREATED: 'Snapshots Created',
        HEALTH_CHECK: 'Health Checks'
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader size={32} className="animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={24} className="text-indigo-600" />
                    <h3 className="font-semibold text-lg text-slate-800">Forensic Audit Trail</h3>
                </div>
                <p className="text-sm text-slate-600">
                    Cryptographically verified record of all bookmark activities.
                </p>
            </div>

            {/* Integrity Status */}
            <div className={`flex items-center gap-3 p-4 rounded-lg ${stats?.chainIntegrity
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-red-50 border border-red-100'
                }`}>
                {stats?.chainIntegrity ? (
                    <>
                        <Check size={24} className="text-green-600" />
                        <div>
                            <div className="font-medium text-green-700">Chain Integrity Verified</div>
                            <div className="text-sm text-green-600">All {stats.totalEntries} entries are cryptographically linked and unmodified.</div>
                        </div>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={24} className="text-red-600" />
                        <div>
                            <div className="font-medium text-red-700">Chain Integrity Broken</div>
                            <div className="text-sm text-red-600">The audit log may have been tampered with.</div>
                        </div>
                    </>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-indigo-600">{stats?.totalEntries || 0}</div>
                    <div className="text-sm text-slate-500">Total Entries</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-slate-700 truncate">{formatDate(stats?.oldestEntry || null)}</div>
                    <div className="text-sm text-slate-500">First Entry</div>
                </div>
            </div>

            {/* Activity Breakdown */}
            {stats && Object.keys(stats.entriesByAction).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h4 className="font-medium text-slate-700 mb-3">Activity Breakdown</h4>
                    <div className="space-y-2">
                        {Object.entries(stats.entriesByAction)
                            .sort(([, a], [, b]) => b - a)
                            .map(([action, count]) => (
                                <div key={action} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{actionLabels[action] || action}</span>
                                    <span className="font-medium text-slate-800">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Export Options */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Download size={16} />
                    Export Audit Certificate
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <FileText size={18} />
                        HTML/PDF
                    </button>
                    <button
                        onClick={handleExportJSON}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <FileJson size={18} />
                        JSON
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    HTML can be printed as PDF. JSON is machine-verifiable for technical audits.
                </p>
            </div>

            {/* Refresh & Close */}
            <div className="flex justify-between pt-2 border-t border-slate-100">
                <button
                    onClick={loadStats}
                    className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
};
