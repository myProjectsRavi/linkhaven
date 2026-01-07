import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Search, ZoomIn, ZoomOut, Maximize2, AlertCircle, Link2, FileText, Tag, Globe, HelpCircle, Sparkles } from 'lucide-react';
import { Bookmark, Note, GraphNode, KnowledgeGraphData } from '../types';
import { buildKnowledgeGraph, applyForceLayout, findOrphans } from '../utils/graphBuilder';

interface KnowledgeGraphProps {
    bookmarks: Bookmark[];
    notes: Note[];
    onNodeClick?: (node: GraphNode) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
    bookmarks,
    notes,
    onNodeClick
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [filter, setFilter] = useState<'all' | 'bookmarks' | 'notes' | 'tags'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Build and layout graph
    const graphData = useMemo(() => {
        const raw = buildKnowledgeGraph(bookmarks, notes);
        return applyForceLayout(raw, dimensions.width, dimensions.height, 150);
    }, [bookmarks, notes, dimensions]);

    // Orphan nodes (no tags)
    const orphans = useMemo(() => findOrphans(graphData), [graphData]);

    // Filter nodes
    const filteredData = useMemo(() => {
        let nodes = graphData.nodes;
        let edges = graphData.edges;

        // Type filter
        if (filter !== 'all') {
            const typeMap: Record<string, string[]> = {
                'bookmarks': ['bookmark', 'domain'],
                'notes': ['note'],
                'tags': ['tag']
            };
            const allowedTypes = typeMap[filter] || [];
            nodes = nodes.filter(n => allowedTypes.includes(n.type));
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            nodes = nodes.filter(n => n.label.toLowerCase().includes(query));
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        return { nodes, edges };
    }, [graphData, filter, searchQuery]);

    // Handle resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({ width: rect.width, height: rect.height - 60 });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Render canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        // Draw edges
        ctx.lineWidth = 1;
        filteredData.edges.forEach(edge => {
            const source = filteredData.nodes.find(n => n.id === edge.source);
            const target = filteredData.nodes.find(n => n.id === edge.target);
            if (!source || !target || !source.x || !source.y || !target.x || !target.y) return;

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target)
                ? '#6366f1'
                : edge.type === 'tag_cooccur' ? '#d1d5db' : '#e2e8f0';
            ctx.stroke();
        });

        // Draw nodes
        filteredData.nodes.forEach(node => {
            if (!node.x || !node.y) return;

            const isHighlighted = selectedNode && (
                selectedNode.id === node.id ||
                filteredData.edges.some(e =>
                    (e.source === selectedNode.id && e.target === node.id) ||
                    (e.target === selectedNode.id && e.source === node.id)
                )
            );

            const isHovered = hoveredNode?.id === node.id;
            const size = isHovered || isHighlighted ? node.size * 1.3 : node.size;

            // Glow for highlighted
            if (isHighlighted) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
                ctx.fill();
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fillStyle = node.color || '#64748b';
            ctx.fill();

            // Border
            ctx.strokeStyle = isHovered ? '#1e293b' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label for hubs and hovered
            if ((node.type === 'tag' || node.type === 'domain' || isHovered) && node.size >= 10) {
                ctx.font = `${isHovered ? 'bold ' : ''}11px Inter, system-ui, sans-serif`;
                ctx.fillStyle = '#374151';
                ctx.textAlign = 'center';
                ctx.fillText(node.label.substring(0, 15), node.x, node.y + size + 14);
            }
        });

        ctx.restore();
    }, [filteredData, dimensions, zoom, pan, hoveredNode, selectedNode]);

    // Handle mouse events
    const findNodeAtPosition = (x: number, y: number): GraphNode | null => {
        const adjustedX = (x - pan.x) / zoom;
        const adjustedY = (y - pan.y) / zoom;

        for (const node of filteredData.nodes) {
            if (!node.x || !node.y) continue;
            const dist = Math.sqrt((node.x - adjustedX) ** 2 + (node.y - adjustedY) ** 2);
            if (dist <= node.size + 5) return node;
        }
        return null;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setHoveredNode(findNodeAtPosition(x, y));
    };

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const node = findNodeAtPosition(x, y);
        setSelectedNode(node);
        if (node && onNodeClick) {
            onNodeClick(node);
        }
    };

    const getNodeIcon = (type: string) => {
        switch (type) {
            case 'bookmark': return <Link2 size={14} className="text-blue-500" />;
            case 'note': return <FileText size={14} className="text-purple-500" />;
            case 'tag': return <Tag size={14} className="text-emerald-500" />;
            case 'domain': return <Globe size={14} className="text-amber-500" />;
            default: return null;
        }
    };

    if (bookmarks.length === 0 && notes.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-16 px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                        <Maximize2 size={32} className="text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">Your Knowledge Graph is Empty</h3>
                    <p className="text-slate-500 max-w-sm">
                        Add bookmarks and notes to see connections between your knowledge.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Sparkles size={20} className="text-indigo-500" />
                        <h2 className="text-lg font-semibold text-slate-800">Your Connection Map</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        {(['all', 'bookmarks', 'notes', 'tags'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilter(type)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === type
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search nodes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-l-lg transition-colors"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="px-2 text-xs text-slate-600 font-medium">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-r-lg transition-colors"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Reset view"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
                <canvas
                    ref={canvasRef}
                    style={{ width: dimensions.width, height: dimensions.height }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={handleClick}
                    className="cursor-crosshair"
                />

                {/* Hover tooltip */}
                {hoveredNode && (
                    <div
                        className="absolute bg-white shadow-lg rounded-lg px-3 py-2 pointer-events-none border border-slate-200"
                        style={{
                            left: (hoveredNode.x || 0) * zoom + pan.x + 20,
                            top: (hoveredNode.y || 0) * zoom + pan.y - 10
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {getNodeIcon(hoveredNode.type)}
                            <span className="font-medium text-slate-800">{hoveredNode.label}</span>
                        </div>
                        <span className="text-xs text-slate-500 capitalize">{hoveredNode.type}</span>
                    </div>
                )}

                {/* Orphans panel */}
                {orphans.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 max-w-xs">
                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                            <AlertCircle size={16} />
                            <span className="font-medium text-sm">Orphan Items</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                            {orphans.length} item{orphans.length !== 1 ? 's' : ''} without tags
                        </p>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {orphans.slice(0, 5).map(node => (
                                <div key={node.id} className="flex items-center gap-2 text-xs text-slate-600">
                                    {getNodeIcon(node.type)}
                                    <span className="truncate">{node.label}</span>
                                </div>
                            ))}
                            {orphans.length > 5 && (
                                <span className="text-xs text-slate-400">+{orphans.length - 5} more</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Legend with user-friendly descriptions */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-4 max-w-[200px]">
                    <div className="flex items-center gap-2 mb-3">
                        <HelpCircle size={14} className="text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-700">What am I seeing?</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                        This shows how your bookmarks, notes, and tags connect to each other.
                    </p>
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <div>
                                <span className="text-slate-700 font-medium">Bookmarks</span>
                                <span className="text-slate-400 ml-1">({bookmarks.length})</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <div>
                                <span className="text-slate-700 font-medium">Notes</span>
                                <span className="text-slate-400 ml-1">({notes.length})</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-slate-700 font-medium">Tags</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-slate-700 font-medium">Websites</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Click any dot to see connections</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg shadow text-xs text-slate-500 px-3 py-2">
                    {filteredData.nodes.length} nodes • {filteredData.edges.length} connections
                </div>
            </div>
        </div>
    );
};
