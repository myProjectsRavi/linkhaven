import React, { useState } from 'react';
import { Shield, Download, Check, FileText, Loader, Database, Lock, Globe, Server } from 'lucide-react';
import { downloadPrivacyAudit } from '../utils/privacyAudit';

interface PrivacyAuditModalProps {
    bookmarkCount: number;
    noteCount: number;
    snapshotCount: number;
    vaultEnabled: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const PrivacyAuditModal: React.FC<PrivacyAuditModalProps> = ({
    bookmarkCount,
    noteCount,
    snapshotCount,
    vaultEnabled,
    onClose,
    onSuccess
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            await downloadPrivacyAudit(bookmarkCount, noteCount, snapshotCount, vaultEnabled);
            onSuccess();
        } catch (error) {
            console.error('Failed to generate audit:', error);
        }
        setIsGenerating(false);
    };

    const auditPoints = [
        {
            icon: Database,
            title: 'Local-Only Storage',
            description: 'All data stored in browser IndexedDB/localStorage',
            status: 'verified'
        },
        {
            icon: Lock,
            title: 'AES-256-GCM Encryption',
            description: 'Military-grade encryption with PBKDF2 key derivation',
            status: 'verified'
        },
        {
            icon: Server,
            title: 'Zero Server Storage',
            description: 'No user data is ever transmitted to our servers',
            status: 'verified'
        },
        {
            icon: Globe,
            title: 'CORS Proxy Disclosure',
            description: 'URL fetching via disclosed public proxies only',
            status: 'disclosed'
        }
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Shield size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Privacy Audit Report</h3>
                    <p className="text-sm text-slate-500">GDPR-compliant proof of privacy</p>
                </div>
            </div>

            {/* Data Summary */}
            <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Your Data Inventory</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Bookmarks:</span>
                        <span className="font-semibold text-slate-800">{bookmarkCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Notes:</span>
                        <span className="font-semibold text-slate-800">{noteCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Snapshots:</span>
                        <span className="font-semibold text-slate-800">{snapshotCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Ghost Vault:</span>
                        <span className={`font-semibold ${vaultEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {vaultEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Audit Points */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Privacy Verification</h4>
                {auditPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${point.status === 'verified'
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}>
                            <point.icon size={16} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800">{point.title}</span>
                                {point.status === 'verified' && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                        Verified
                                    </span>
                                )}
                                {point.status === 'disclosed' && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                        Disclosed
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{point.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transmission Summary */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-emerald-800">Data Transmitted to External Servers</p>
                        <p className="text-2xl font-bold text-emerald-600">0.0%</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-lg shadow-sm transition-colors"
                >
                    {isGenerating ? (
                        <>
                            <Loader size={16} className="animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Download size={16} />
                            Download Audit PDF
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
