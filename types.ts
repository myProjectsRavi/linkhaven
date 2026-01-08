export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  url: string;
  tags?: string[];
  linkHealth?: 'alive' | 'dead' | 'unknown' | 'checking';
  lastHealthCheck?: number;
  // Eternal Vault - Offline page snapshots
  snapshot?: {
    savedAt: number;      // When the snapshot was saved
    size: number;         // Compressed size in bytes
    excerpt: string;      // First 200 chars for preview
  };
  createdAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  createdAt: number;
}

// Version history for notes
export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  changeType: 'created' | 'edited' | 'restored';
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
  versions?: NoteVersion[];  // Last 10 versions for history
}

// Trash bin item
export interface TrashedItem {
  id: string;
  type: 'bookmark' | 'note' | 'folder' | 'notebook';
  item: Bookmark | Note | Folder | Notebook;
  deletedAt: number;
  autoDeleteAt: number;  // 30 days after deletedAt
  originalLocation?: string;  // For restoring to correct folder/notebook
}

// Knowledge Graph types
export interface GraphNode {
  id: string;
  type: 'bookmark' | 'note' | 'tag' | 'domain';
  label: string;
  size: number;
  color?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'has_tag' | 'same_domain' | 'tag_cooccur' | 'linked';
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type ModalType =
  | 'ADD_BOOKMARK'
  | 'ADD_FOLDER'
  | 'EDIT_FOLDER'
  | 'EDIT_BOOKMARK'
  | 'IMPORT_CONFIRMATION'
  | 'BOOKMARKLET'
  | 'HEALTH_CHECK_PROGRESS'
  // Premium modals
  | 'SNAPSHOT_VIEWER'
  | 'SNAPSHOT_CAPTURE'
  | 'DEDUPLICATION'
  | 'QR_SYNC'
  | 'CLEANUP_WIZARD'
  | 'PREMIUM_UPGRADE'
  | 'VERSION_HISTORY'
  // Notes modals
  | 'ADD_NOTE'
  | 'EDIT_NOTE'
  | 'ADD_NOTEBOOK'
  | 'NOTEBOOK_SYNC'
  | 'VIEW_NOTE'
  | 'SHARE_NOTE'
  | 'UNLOCK_NOTE'
  // Premium Features
  | 'RULES_BUILDER'
  | 'CITATION_VIEW'
  | 'DUPLICATE_FINDER'
  // New Features (Privacy & Export)
  | 'PRIVACY_AUDIT'
  | 'P2P_SYNC'
  | 'EXPORT_AS_BOOK'
  | null;

// Main view types
export type MainView = 'bookmarks' | 'notes' | 'graph' | 'trash';

export interface ViewState {
  activeFolderId: string | 'ALL';
  searchQuery: string;
  isSidebarOpen: boolean;
  mainView: MainView;
}

// For tag filtering
export interface TagFilter {
  tag: string;
  active: boolean;
}

// Premium feature flags - Updated for new features
export interface PremiumFeatures {
  eternalVault: boolean;      // Page snapshots
  deduplication: boolean;     // Fuzzy duplicate finder
  qrSync: boolean;            // Multi-device sync via QR
  versionHistory: boolean;    // Note version history
  trashBin: boolean;          // 30-day trash recovery
  knowledgeGraph: boolean;    // Visual knowledge map
  syncDevices: boolean;       // Cloud sync (future)
}

// Premium subscription status - Simplified to Free/Pro
export interface PremiumStatus {
  isPro: boolean;
  plan?: 'monthly' | 'lifetime';
  expiresAt?: number;
  features: PremiumFeatures;
}