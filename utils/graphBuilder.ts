import { Bookmark, Note, GraphNode, GraphEdge, KnowledgeGraphData } from '../types';
import { SimHash64, hammingDistance, distanceToSimilarity, generateSimHash } from './simhash';

/**
 * Builds a knowledge graph from bookmarks and notes
 * Uses tag co-occurrence and domain extraction for edges
 */
export function buildKnowledgeGraph(
    bookmarks: Bookmark[],
    notes: Note[]
): KnowledgeGraphData {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();
    const tagConnections = new Map<string, number>();

    // Color palette
    const colors = {
        bookmark: '#3B82F6', // blue
        note: '#8B5CF6',     // purple
        tag: '#10B981',      // emerald
        domain: '#F59E0B'    // amber
    };

    // Extract domain from URL
    const getDomain = (url: string): string => {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    };

    // Add bookmark nodes
    bookmarks.forEach(bookmark => {
        const nodeId = `bookmark_${bookmark.id}`;
        const node: GraphNode = {
            id: nodeId,
            type: 'bookmark',
            label: bookmark.title || bookmark.url,
            size: 8,
            color: colors.bookmark
        };
        nodes.push(node);
        nodeMap.set(nodeId, node);

        // Add domain node and edge
        const domain = getDomain(bookmark.url);
        const domainNodeId = `domain_${domain}`;
        if (!nodeMap.has(domainNodeId)) {
            const domainNode: GraphNode = {
                id: domainNodeId,
                type: 'domain',
                label: domain,
                size: 12,
                color: colors.domain
            };
            nodes.push(domainNode);
            nodeMap.set(domainNodeId, domainNode);
        }

        edges.push({
            source: nodeId,
            target: domainNodeId,
            weight: 1,
            type: 'same_domain'
        });

        // Add tag nodes and edges
        bookmark.tags?.forEach(tag => {
            const tagNodeId = `tag_${tag}`;
            if (!nodeMap.has(tagNodeId)) {
                const tagNode: GraphNode = {
                    id: tagNodeId,
                    type: 'tag',
                    label: `#${tag}`,
                    size: 10,
                    color: colors.tag
                };
                nodes.push(tagNode);
                nodeMap.set(tagNodeId, tagNode);
            }

            edges.push({
                source: nodeId,
                target: tagNodeId,
                weight: 1,
                type: 'has_tag'
            });

            // Track tag co-occurrence
            bookmark.tags?.forEach(otherTag => {
                if (tag !== otherTag) {
                    const key = [tag, otherTag].sort().join('|');
                    tagConnections.set(key, (tagConnections.get(key) || 0) + 1);
                }
            });
        });
    });

    // Add note nodes
    notes.forEach(note => {
        const nodeId = `note_${note.id}`;
        const node: GraphNode = {
            id: nodeId,
            type: 'note',
            label: note.title,
            size: 8,
            color: colors.note
        };
        nodes.push(node);
        nodeMap.set(nodeId, node);

        // Add tag nodes and edges
        note.tags?.forEach(tag => {
            const tagNodeId = `tag_${tag}`;
            if (!nodeMap.has(tagNodeId)) {
                const tagNode: GraphNode = {
                    id: tagNodeId,
                    type: 'tag',
                    label: `#${tag}`,
                    size: 10,
                    color: colors.tag
                };
                nodes.push(tagNode);
                nodeMap.set(tagNodeId, tagNode);
            }

            edges.push({
                source: nodeId,
                target: tagNodeId,
                weight: 1,
                type: 'has_tag'
            });

            // Track tag co-occurrence
            note.tags?.forEach(otherTag => {
                if (tag !== otherTag) {
                    const key = [tag, otherTag].sort().join('|');
                    tagConnections.set(key, (tagConnections.get(key) || 0) + 1);
                }
            });
        });
    });

    // Add tag co-occurrence edges
    tagConnections.forEach((count, key) => {
        const [tag1, tag2] = key.split('|');
        edges.push({
            source: `tag_${tag1}`,
            target: `tag_${tag2}`,
            weight: count,
            type: 'tag_cooccur'
        });
    });

    // Update node sizes based on connections
    const connectionCounts = new Map<string, number>();
    edges.forEach(edge => {
        connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
        connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    });

    nodes.forEach(node => {
        const connections = connectionCounts.get(node.id) || 0;
        if (node.type === 'tag' || node.type === 'domain') {
            node.size = Math.min(20, 8 + connections * 2);
        }
    });

    return { nodes, edges };
}

/**
 * Simple force-directed layout algorithm
 * Positions nodes in 2D space based on edges
 */
export function applyForceLayout(
    data: KnowledgeGraphData,
    width: number,
    height: number,
    iterations: number = 100
): KnowledgeGraphData {
    const nodes = data.nodes.map(n => ({
        ...n,
        x: n.x ?? Math.random() * width,
        y: n.y ?? Math.random() * height,
        vx: 0,
        vy: 0
    }));

    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

    const k = Math.sqrt((width * height) / nodes.length) * 0.5; // Optimal distance
    const gravity = 0.1;
    const repulsion = k * k;
    const attraction = 0.1;

    for (let iter = 0; iter < iterations; iter++) {
        const temperature = 1 - iter / iterations;

        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x! - nodes[i].x!;
                const dy = nodes[j].y! - nodes[i].y!;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const force = repulsion / (dist * dist);

                const fx = (dx / dist) * force * temperature;
                const fy = (dy / dist) * force * temperature;

                nodes[i].vx -= fx;
                nodes[i].vy -= fy;
                nodes[j].vx += fx;
                nodes[j].vy += fy;
            }
        }

        // Attraction along edges
        data.edges.forEach(edge => {
            const sourceIdx = nodeIndex.get(edge.source);
            const targetIdx = nodeIndex.get(edge.target);
            if (sourceIdx === undefined || targetIdx === undefined) return;

            const source = nodes[sourceIdx];
            const target = nodes[targetIdx];

            const dx = target.x! - source.x!;
            const dy = target.y! - source.y!;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const force = (dist - k) * attraction * edge.weight * temperature;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        });

        // Gravity towards center
        const cx = width / 2;
        const cy = height / 2;
        nodes.forEach(node => {
            node.vx += (cx - node.x!) * gravity * temperature;
            node.vy += (cy - node.y!) * gravity * temperature;
        });

        // Apply velocities
        nodes.forEach(node => {
            node.x = Math.max(50, Math.min(width - 50, node.x! + node.vx));
            node.y = Math.max(50, Math.min(height - 50, node.y! + node.vy));
            node.vx *= 0.8; // Damping
            node.vy *= 0.8;
        });
    }

    return {
        nodes: nodes.map(({ vx, vy, ...n }) => n),
        edges: data.edges
    };
}

/**
 * Find orphan nodes (items with no tags)
 */
export function findOrphans(data: KnowledgeGraphData): GraphNode[] {
    const connectedNodes = new Set<string>();
    data.edges.forEach(edge => {
        if (edge.type === 'has_tag') {
            connectedNodes.add(edge.source);
        }
    });

    return data.nodes.filter(
        node => (node.type === 'bookmark' || node.type === 'note') && !connectedNodes.has(node.id)
    );
}

/**
 * Find bridge nodes (tags that connect different clusters)
 */
export function findBridges(data: KnowledgeGraphData): GraphNode[] {
    // Tags connected to multiple other tags
    const tagNeighbors = new Map<string, Set<string>>();

    data.edges.forEach(edge => {
        if (edge.type === 'tag_cooccur') {
            if (!tagNeighbors.has(edge.source)) tagNeighbors.set(edge.source, new Set());
            if (!tagNeighbors.has(edge.target)) tagNeighbors.set(edge.target, new Set());
            tagNeighbors.get(edge.source)!.add(edge.target);
            tagNeighbors.get(edge.target)!.add(edge.source);
        }
    });

    return data.nodes.filter(
        node => node.type === 'tag' && (tagNeighbors.get(node.id)?.size || 0) >= 3
    );
}

/**
 * Add SimHash-based content similarity edges to the graph
 * 
 * FEATURE: "Discover hidden connections between your ideas"
 * Uses SimHash fingerprints to find bookmarks with similar content
 * even if they have no shared tags or domains.
 * 
 * ALGORITHM:
 * 1. Generate SimHash for each bookmark's text content
 * 2. Compare all pairs using Hamming distance
 * 3. Add "similar_content" edge for pairs with distance <= threshold
 * 
 * COMPLEXITY: O(n²) comparison, but SimHash comparison is O(1) per pair
 * For 1000 bookmarks: 500,000 comparisons × O(1) = still fast
 * 
 * VISUAL: Similar bookmarks cluster together in the graph
 */
export function addSimHashEdges(
    data: KnowledgeGraphData,
    bookmarks: Bookmark[],
    snapshotContents?: Map<string, string>,
    similarityThreshold: number = 10 // Hamming distance <= 10 = ~85% similar
): KnowledgeGraphData {
    const bookmarkNodes = data.nodes.filter(n => n.type === 'bookmark');

    if (bookmarkNodes.length < 2) {
        return data;
    }

    // Generate SimHash for each bookmark
    const hashes = new Map<string, SimHash64>();

    for (const bookmark of bookmarks) {
        // Combine title, description, and snapshot content for fingerprinting
        const textParts = [
            bookmark.title || '',
            bookmark.description || '',
            ...(bookmark.tags || [])
        ];

        // Add snapshot content if available
        if (snapshotContents?.has(bookmark.id)) {
            textParts.push(snapshotContents.get(bookmark.id)!);
        }

        const text = textParts.join(' ');
        if (text.trim()) {
            hashes.set(bookmark.id, generateSimHash(text));
        }
    }

    // Find similar pairs and create edges
    const newEdges = [...data.edges];
    const bookmarkIds = Array.from(hashes.keys());

    for (let i = 0; i < bookmarkIds.length; i++) {
        for (let j = i + 1; j < bookmarkIds.length; j++) {
            const id1 = bookmarkIds[i];
            const id2 = bookmarkIds[j];
            const hash1 = hashes.get(id1)!;
            const hash2 = hashes.get(id2)!;

            const distance = hammingDistance(hash1, hash2);

            if (distance <= similarityThreshold) {
                const similarity = distanceToSimilarity(distance);

                newEdges.push({
                    source: `bookmark_${id1}`,
                    target: `bookmark_${id2}`,
                    // Weight based on similarity (higher = stronger attraction in layout)
                    weight: similarity / 50, // Normalize to 0-2 range
                    type: 'linked' // "Similar content" edge type
                });
            }
        }
    }

    return {
        nodes: data.nodes,
        edges: newEdges
    };
}

/**
 * Build enhanced knowledge graph with SimHash similarity edges
 * 
 * Combines:
 * 1. Tag-based connections
 * 2. Domain-based connections
 * 3. Content similarity connections (SimHash)
 * 
 * This provides a richer visualization of knowledge relationships.
 */
export function buildEnhancedKnowledgeGraph(
    bookmarks: Bookmark[],
    notes: Note[],
    snapshotContents?: Map<string, string>
): KnowledgeGraphData {
    // Build base graph with tags and domains
    let graph = buildKnowledgeGraph(bookmarks, notes);

    // Add SimHash-based content similarity edges
    graph = addSimHashEdges(graph, bookmarks, snapshotContents);

    return graph;
}
