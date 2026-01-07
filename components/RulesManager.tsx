/**
 * RulesManager - View, edit, delete rules as cards
 * 
 * Shows all automation rules with ability to toggle, edit, delete.
 * Also provides "Apply to All" button to run rules on existing bookmarks.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Zap, Check, Power, PlayCircle, AlertCircle } from 'lucide-react';
import { AutomationRule, RuleCondition, RuleAction } from '../utils/ruleEngine';
import { RuleBuilder } from './RuleBuilder';

interface RulesManagerProps {
    isOpen: boolean;
    onClose: () => void;
    rules: AutomationRule[];
    onSaveRule: (rule: AutomationRule) => Promise<void>;
    onDeleteRule: (ruleId: string) => Promise<void>;
    onToggleRule: (ruleId: string) => Promise<void>;
    onAddRule: (name: string, condition: RuleCondition, action: RuleAction) => Promise<AutomationRule>;
    onApplyAllRules: () => Promise<{ processed: number; matched: number }>;
}

const formatCondition = (condition: RuleCondition): string => {
    if (condition.url?.contains) return `URL contains "${condition.url.contains}"`;
    if (condition.url?.domain) return `Domain is "${condition.url.domain}"`;
    if (condition.tag?.hasTag) return `Has tag "${condition.tag.hasTag}"`;
    if (condition.tag?.noTags) return `Has no tags`;
    if (condition.content?.titleContains) return `Title contains "${condition.content.titleContains}"`;
    if (condition.or) return `OR: ${condition.or.map(formatCondition).join(', ')}`;
    return 'Custom condition';
};

const formatAction = (action: RuleAction): string => {
    const parts: string[] = [];
    if (action.addTag) parts.push(`Add tag "${action.addTag}"`);
    if (action.addTags) parts.push(`Add tags: ${action.addTags.join(', ')}`);
    if (action.removeTag) parts.push(`Remove tag "${action.removeTag}"`);
    if (action.moveToFolder) parts.push(`Move to folder "${action.moveToFolder}"`);
    return parts.join(', ') || 'No action';
};

export const RulesManager: React.FC<RulesManagerProps> = ({
    isOpen,
    onClose,
    rules,
    onSaveRule,
    onDeleteRule,
    onToggleRule,
    onAddRule,
    onApplyAllRules,
}) => {
    const [showBuilder, setShowBuilder] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<{ processed: number; matched: number } | null>(null);

    if (!isOpen) return null;

    const handleApplyAll = async () => {
        setIsApplying(true);
        setApplyResult(null);
        try {
            const result = await onApplyAllRules();
            setApplyResult(result);
        } finally {
            setIsApplying(false);
        }
    };

    const handleSaveNewRule = async (name: string, condition: RuleCondition, action: RuleAction) => {
        await onAddRule(name, condition, action);
        setShowBuilder(false);
    };

    const handleSaveEditedRule = async (name: string, condition: RuleCondition, action: RuleAction) => {
        if (editingRule) {
            await onSaveRule({
                ...editingRule,
                name,
                condition,
                action,
                updatedAt: Date.now(),
            });
        }
        setEditingRule(null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Smart Rules</h2>
                            <p className="text-indigo-100 text-sm">{rules.length} rules • {rules.filter(r => r.enabled).length} active</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Actions Bar */}
                <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus size={16} />
                        New Rule
                    </button>
                    <button
                        onClick={handleApplyAll}
                        disabled={isApplying || rules.filter(r => r.enabled).length === 0}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        <PlayCircle size={16} className={isApplying ? 'animate-spin' : ''} />
                        {isApplying ? 'Applying...' : 'Apply to All Bookmarks'}
                    </button>
                </div>

                {/* Apply Result */}
                {applyResult && (
                    <div className="mx-6 mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm text-emerald-700">
                        <Check size={16} />
                        Processed {applyResult.processed} bookmarks, {applyResult.matched} matched rules
                    </div>
                )}

                {/* Rules List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {rules.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-1">No Rules Yet</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Create automation rules to organize bookmarks automatically.
                            </p>
                            <button
                                onClick={() => setShowBuilder(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm"
                            >
                                Create First Rule
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className={`bg-white border rounded-xl p-4 transition-all ${rule.enabled
                                            ? 'border-indigo-200 shadow-sm'
                                            : 'border-slate-200 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onToggleRule(rule.id)}
                                                className={`p-1 rounded ${rule.enabled
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : 'bg-slate-100 text-slate-400'
                                                    }`}
                                                title={rule.enabled ? 'Enabled' : 'Disabled'}
                                            >
                                                <Power size={14} />
                                            </button>
                                            <h4 className="font-semibold text-slate-800">{rule.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingRule(rule)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete rule "${rule.name}"?`)) {
                                                        onDeleteRule(rule.id);
                                                    }
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-sm space-y-1">
                                        <p className="text-slate-600">
                                            <span className="font-medium text-indigo-600">IF</span>{' '}
                                            {formatCondition(rule.condition)}
                                        </p>
                                        <p className="text-slate-600">
                                            <span className="font-medium text-purple-600">THEN</span>{' '}
                                            {formatAction(rule.action)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                                        <span>Matched {rule.matchCount} times</span>
                                        <span>•</span>
                                        <span>Priority {rule.priority}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Rule Builder Modal */}
            <RuleBuilder
                isOpen={showBuilder || editingRule !== null}
                onClose={() => {
                    setShowBuilder(false);
                    setEditingRule(null);
                }}
                onSave={editingRule ? handleSaveEditedRule : handleSaveNewRule}
                existingRule={editingRule || undefined}
            />
        </div>
    );
};
