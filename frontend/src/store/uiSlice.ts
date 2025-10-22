import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface Modal {
  id: string;
  type: 'confirm' | 'info' | 'custom';
  title: string;
  content: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';

  // Layout
  sidebarCollapsed: boolean;
  isMobile: boolean;

  // Loading states
  globalLoading: boolean;

  // Toasts
  toasts: Toast[];

  // Modals
  modals: Modal[];

  // Navigation
  currentPage: string;
  breadcrumbs: Array<{ label: string; path?: string }>;

  // Search
  globalSearchOpen: boolean;
  globalSearchQuery: string;

  // Clipboard
  lastCopiedText: string | null;

  // Preferences (UI-related only, user preferences are in separate slice)
  preferences: {
    animationsEnabled: boolean;
    soundEnabled: boolean;
    compactMode: boolean;
    showTooltips: boolean;
  };
}

const initialState: UIState = {
  theme: 'light',
  sidebarCollapsed: false,
  isMobile: false,
  globalLoading: false,
  toasts: [],
  modals: [],
  currentPage: '',
  breadcrumbs: [],
  globalSearchOpen: false,
  globalSearchQuery: '',
  lastCopiedText: null,
  preferences: {
    animationsEnabled: true,
    soundEnabled: true,
    compactMode: false,
    showTooltips: true,
  },
};

let toastIdCounter = 0;
let modalIdCounter = 0;

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },

    initializeTheme: (state) => {
      const savedTheme = localStorage.getItem('theme') as
        | 'light'
        | 'dark'
        | 'system'
        | null;
      if (savedTheme) {
        state.theme = savedTheme;
      }
    },

    // Layout
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem('sidebarCollapsed', String(state.sidebarCollapsed));
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem('sidebarCollapsed', String(action.payload));
    },

    setIsMobile: (state, action: PayloadAction<boolean>) => {
      state.isMobile = action.payload;
      // Auto-collapse sidebar on mobile
      if (action.payload) {
        state.sidebarCollapsed = true;
      }
    },

    initializeLayout: (state) => {
      const savedSidebarState = localStorage.getItem('sidebarCollapsed');
      if (savedSidebarState !== null) {
        state.sidebarCollapsed = savedSidebarState === 'true';
      }
    },

    // Loading
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },

    // Toasts
    addToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const toast: Toast = {
        ...action.payload,
        id: `toast-${++toastIdCounter}`,
        duration: action.payload.duration ?? 5000,
      };
      state.toasts.push(toast);
    },

    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(
        (toast) => toast.id !== action.payload
      );
    },

    clearAllToasts: (state) => {
      state.toasts = [];
    },

    // Modals
    addModal: (state, action: PayloadAction<Omit<Modal, 'id'>>) => {
      const modal: Modal = {
        ...action.payload,
        id: `modal-${++modalIdCounter}`,
      };
      state.modals.push(modal);
    },

    removeModal: (state, action: PayloadAction<string>) => {
      state.modals = state.modals.filter(
        (modal) => modal.id !== action.payload
      );
    },

    clearAllModals: (state) => {
      state.modals = [];
    },

    // Navigation
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.currentPage = action.payload;
    },

    setBreadcrumbs: (
      state,
      action: PayloadAction<Array<{ label: string; path?: string }>>
    ) => {
      state.breadcrumbs = action.payload;
    },

    // Search
    setGlobalSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.globalSearchOpen = action.payload;
      if (!action.payload) {
        state.globalSearchQuery = '';
      }
    },

    setGlobalSearchQuery: (state, action: PayloadAction<string>) => {
      state.globalSearchQuery = action.payload;
    },

    // Clipboard
    setLastCopiedText: (state, action: PayloadAction<string>) => {
      state.lastCopiedText = action.payload;
    },

    // Preferences
    setUIPreferences: (
      state,
      action: PayloadAction<Partial<UIState['preferences']>>
    ) => {
      state.preferences = { ...state.preferences, ...action.payload };
      localStorage.setItem('uiPreferences', JSON.stringify(state.preferences));
    },

    initializeUIPreferences: (state) => {
      const savedPreferences = localStorage.getItem('uiPreferences');
      if (savedPreferences) {
        try {
          const parsed = JSON.parse(savedPreferences);
          state.preferences = { ...state.preferences, ...parsed };
        } catch (error) {
          console.warn(
            'Failed to parse UI preferences from localStorage',
            error
          );
        }
      }
    },

    // Utility actions
    showSuccessToast: (
      state,
      action: PayloadAction<{ title: string; message?: string }>
    ) => {
      const toast: Toast = {
        id: `toast-${++toastIdCounter}`,
        type: 'success',
        title: action.payload.title,
        message: action.payload.message,
        duration: 5000,
      };
      state.toasts.push(toast);
    },

    showErrorToast: (
      state,
      action: PayloadAction<{ title: string; message?: string }>
    ) => {
      const toast: Toast = {
        id: `toast-${++toastIdCounter}`,
        type: 'error',
        title: action.payload.title,
        message: action.payload.message,
        duration: 7000,
      };
      state.toasts.push(toast);
    },

    showWarningToast: (
      state,
      action: PayloadAction<{ title: string; message?: string }>
    ) => {
      const toast: Toast = {
        id: `toast-${++toastIdCounter}`,
        type: 'warning',
        title: action.payload.title,
        message: action.payload.message,
        duration: 6000,
      };
      state.toasts.push(toast);
    },

    showInfoToast: (
      state,
      action: PayloadAction<{ title: string; message?: string }>
    ) => {
      const toast: Toast = {
        id: `toast-${++toastIdCounter}`,
        type: 'info',
        title: action.payload.title,
        message: action.payload.message,
        duration: 5000,
      };
      state.toasts.push(toast);
    },

    showConfirmModal: (
      state,
      action: PayloadAction<{
        title: string;
        content: string;
        onConfirm: () => void;
        onCancel?: () => void;
        confirmText?: string;
        cancelText?: string;
      }>
    ) => {
      const modal: Modal = {
        id: `modal-${++modalIdCounter}`,
        type: 'confirm',
        ...action.payload,
      };
      state.modals.push(modal);
    },
  },
});

export const {
  setTheme,
  initializeTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setIsMobile,
  initializeLayout,
  setGlobalLoading,
  addToast,
  removeToast,
  clearAllToasts,
  addModal,
  removeModal,
  clearAllModals,
  setCurrentPage,
  setBreadcrumbs,
  setGlobalSearchOpen,
  setGlobalSearchQuery,
  setLastCopiedText,
  setUIPreferences,
  initializeUIPreferences,
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  showConfirmModal,
} = uiSlice.actions;

export default uiSlice.reducer;
