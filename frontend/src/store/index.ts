import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../services/api';
import authReducer from './authSlice';
import urlReducer from './urlSlice';
import analyticsReducer from './analyticsSlice';
import uiReducer from './uiSlice';
import userReducer from './userSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    urls: urlReducer,
    analytics: analyticsReducer,
    ui: uiReducer,
    user: userReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          // Ignore these action types
          'ui/addToast',
          'ui/addModal',
          'ui/showConfirmModal',
        ],
        ignoredPaths: [
          // Ignore these paths in the state
          'ui.toasts',
          'ui.modals',
        ],
      },
    }).concat(api.middleware),
  devTools: true,
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;