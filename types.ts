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
  createdAt: number;
}

export type ModalType = 'ADD_BOOKMARK' | 'ADD_FOLDER' | 'EDIT_FOLDER' | 'EDIT_BOOKMARK' | 'IMPORT_CONFIRMATION' | null;

export interface ViewState {
  activeFolderId: string | 'ALL';
  searchQuery: string;
  isSidebarOpen: boolean;
}