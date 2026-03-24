import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'

const apiUrl = import.meta.env.VITE_API_URL as string

interface DecodeState {
  userData: Record<string, any>
  isLoading: boolean
  error: string | null
}

interface RootState {
  decode: DecodeState
}

/**
 * Restore auth state on page load by asking the server whether the session
 * cookie is still valid.  Returns the user data embedded in the session JWT.
 */
export const initUser = createAsyncThunk<
  Record<string, any>,
  void,
  { rejectValue: string }
>('decode/initUser', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get(`${apiUrl}/api/secure/me`)
    if (response.data?.success) {
      return response.data.data
    }
    return rejectWithValue('Failed to fetch user data')
  } catch {
    return rejectWithValue('No active session')
  }
})

const initialState: DecodeState = {
  userData: {},
  isLoading: false,
  error: null,
}

const decodeSlice = createSlice({
  name: 'decode',
  initialState,
  reducers: {
    setUserData: (state, action: PayloadAction<Record<string, any>>) => {
      state.userData = action.payload
    },
    clearUserData: (state) => {
      state.userData = {}
      state.error = null
    },
    // Kept for backwards-compatibility — clears user state
    clearDecryptedData: (state) => {
      state.userData = {}
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(initUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.userData = action.payload
      })
      .addCase(initUser.rejected, (state) => {
        state.isLoading = false
        state.userData = {}
      })
  },
})

export const { setUserData, clearUserData, clearDecryptedData, clearError } = decodeSlice.actions
export default decodeSlice.reducer

// Selectors
export const selectIsLoading = (state: RootState) => state.decode.isLoading
export const selectError     = (state: RootState) => state.decode.error
export const selectUserData  = (state: RootState) => state.decode.userData
// Kept for backwards-compatibility (callers can safely read null)
export const selectDecryptedData = (_state: RootState) => null
