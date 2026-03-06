import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import socketClient from '@/SocketConnection/socketClient';
/* =========================
   TYPES
========================= */
interface SocketState {
  isConnected: boolean;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  socketId: string | null;
  lastConnected: number | null;
  connectionAttempts: number;
  companyId: string | null;
}

/* =========================
   INITIAL STATE
========================= */
const initialState: SocketState = {
  isConnected: false,
  connectionStatus: 'idle',
  error: null,
  socketId: null,
  lastConnected: null,
  connectionAttempts: 0,
  companyId: null
};

/* =========================
   ASYNC THUNKS
========================= */
export const connectSocket = createAsyncThunk<
  string, // Returns socket ID
  { url: string; companyId?: string },
  { rejectValue: string }
>(
  'socket/connect',
  async ({ url, companyId }, { dispatch, rejectWithValue }) => {
    return new Promise<string>((resolve, reject) => {
      try {
        // Get or create socket instance
        const socket = socketClient.connect(url);

        if (!socket) {
          return reject(rejectWithValue('Failed to create socket instance'));
        }

        // Set company ID
        if (companyId) {
          dispatch(setCompanyId(companyId));
        }

        // Connect event
        socket.on('connect', () => {
          console.log('✅ Socket Connected:', socket.id);
          dispatch(setSocketId(socket.id || null));
          dispatch(setConnectionStatus('connected'));
          dispatch(setIsConnected(true));
          dispatch(setLastConnected(Date.now()));
          dispatch(resetConnectionAttempts());

          // Join company room
          if (companyId) {
            socket.emit('join-company', companyId);
            console.log(`📍 Joined company room: ${companyId}`);
          }

          resolve(socket.id || 'unknown');
        });

        // Disconnect event
        socket.on('disconnect', (reason) => {
          console.log('❌ Socket Disconnected:', reason);
          dispatch(setIsConnected(false));
          dispatch(setConnectionStatus('disconnected'));
          dispatch(setSocketId(null));
        });

        // Connection error
        socket.on('connect_error', (error: Error) => {
          console.error('🔴 Socket Connection Error:', error.message);
          dispatch(setError(error.message));
          dispatch(setConnectionStatus('error'));
          dispatch(incrementConnectionAttempts());
          reject(rejectWithValue(error.message));
        });

        // Reconnect attempt
        socket.io.on('reconnect_attempt', (attemptNumber) => {
          console.log(`🔄 Reconnection attempt: ${attemptNumber}`);
          dispatch(setConnectionStatus('connecting'));
          dispatch(incrementConnectionAttempts());
        });

        // Reconnect success
        socket.io.on('reconnect', (attemptNumber) => {
          console.log(`✅ Reconnected after ${attemptNumber} attempts`);
          dispatch(setConnectionStatus('connected'));
          dispatch(resetConnectionAttempts());
          
          // Rejoin company room on reconnect
          if (companyId) {
            socket.emit('join-company', companyId);
          }
        });

        // Reconnect failed
        socket.io.on('reconnect_failed', () => {
          console.error('❌ Reconnection failed');
          dispatch(setError('Failed to reconnect'));
          dispatch(setConnectionStatus('error'));
        });

        // Start connection
        dispatch(setConnectionStatus('connecting'));
        socket.connect();

      } catch (error: any) {
        console.error('Socket connection error:', error);
        reject(rejectWithValue(error.message || 'Unknown connection error'));
      }
    });
  }
);

export const disconnectSocket = createAsyncThunk(
  'socket/disconnect',
  async (_, { dispatch, getState }) => {
    const state = getState() as any;
    const { companyId } = state.socket;

    const socket = socketClient.getSocket();
    
    if (socket && socket.connected) {
      // Leave company room before disconnect
      if (companyId) {
        socket.emit('leave-company', companyId);
        console.log(`📍 Left company room: ${companyId}`);
      }

      // Remove all listeners
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.io.off('reconnect_attempt');
      socket.io.off('reconnect');
      socket.io.off('reconnect_failed');
    }

    socketClient.disconnect();
    
    dispatch(setIsConnected(false));
    dispatch(setConnectionStatus('disconnected'));
    dispatch(setSocketId(null));
    dispatch(setCompanyId(null));
    
    console.log('🔌 Socket Disconnected');
  }
);

export const reconnectSocket = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>(
  'socket/reconnect',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as any;
    const socket = socketClient.getSocket();

    if (!socket) {
      return rejectWithValue('Socket instance not found');
    }

    if (socket.connected) {
      return rejectWithValue('Socket is already connected');
    }

    socket.connect();
  }
);

/* =========================
   SLICE
========================= */
const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setIsConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setConnectionStatus: (
      state,
      action: PayloadAction<SocketState['connectionStatus']>
    ) => {
      state.connectionStatus = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setSocketId: (state, action: PayloadAction<string | null>) => {
      state.socketId = action.payload;
    },
    setLastConnected: (state, action: PayloadAction<number>) => {
      state.lastConnected = action.payload;
    },
    incrementConnectionAttempts: (state) => {
      state.connectionAttempts += 1;
    },
    resetConnectionAttempts: (state) => {
      state.connectionAttempts = 0;
    },
    setCompanyId: (state, action: PayloadAction<string | null>) => {
      state.companyId = action.payload;
    },
    resetSocketState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Connect
      .addCase(connectSocket.pending, (state) => {
        state.connectionStatus = 'connecting';
        state.error = null;
      })
      .addCase(connectSocket.fulfilled, (state, action) => {
        state.isConnected = true;
        state.connectionStatus = 'connected';
        state.socketId = action.payload;
        state.error = null;
        state.connectionAttempts = 0;
      })
      .addCase(connectSocket.rejected, (state, action) => {
        state.isConnected = false;
        state.connectionStatus = 'error';
        state.error = action.payload || 'Connection failed';
      })
      
      // Disconnect
      .addCase(disconnectSocket.fulfilled, (state) => {
        state.isConnected = false;
        state.connectionStatus = 'disconnected';
        state.socketId = null;
        state.companyId = null;
        state.error = null;
      })
      
      // Reconnect
      .addCase(reconnectSocket.pending, (state) => {
        state.connectionStatus = 'connecting';
      })
      .addCase(reconnectSocket.rejected, (state, action) => {
        state.error = action.payload || 'Reconnection failed';
      });
  }
});

/* =========================
   EXPORTS
========================= */
export const {
  setIsConnected,
  setConnectionStatus,
  setError,
  clearError,
  setSocketId,
  setLastConnected,
  incrementConnectionAttempts,
  resetConnectionAttempts,
  setCompanyId,
  resetSocketState
} = socketSlice.actions;

export default socketSlice.reducer;

/* =========================
   SELECTORS
========================= */
export const selectSocketConnected = (state: any) => state.socket.isConnected;
export const selectConnectionStatus = (state: any) => state.socket.connectionStatus;
export const selectSocketError = (state: any) => state.socket.error;
export const selectSocketId = (state: any) => state.socket.socketId;
export const selectLastConnected = (state: any) => state.socket.lastConnected;
export const selectConnectionAttempts = (state: any) => state.socket.connectionAttempts;
export const selectCompanyId = (state: any) => state.socket.companyId;
