import React from 'react';
import { X, Calendar, Tag, BookOpen } from 'lucide-react';
import { Note, Notebook } from '../types';

interface NoteViewerProps {
    note: Note;
    notebooks: Notebook[];
    onClose: () => void;
    onEdit: () => void;
}

export const NoteViewer: React.FC<NoteViewerProps> = ({ note, notebooks, onClose, onEdit }) => {
    const notebookName = notebooks.find(n => n.id === note.notebookId)?.name || 'General';

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1 bg-purple-50 text-purple-600 px-2 py-1 rounded-lg">
                    <BookOpen size={14} />
                    {notebookName}
                </span>
                <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(note.updatedAt || note.createdAt)}
                </span>
            </div>

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                        <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs"
                        >
                            <Tag size={10} />
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="bg-slate-50 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere font-sans text-slate-700 leading-relaxed text-sm">
                    {note.content}
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
                    onClick={onEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                    Edit Note
                </button>
            </div>
        </div>
    );
};
