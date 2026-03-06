import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ConfigState {
  apiUrl: string
  username: string
  password: string
}

interface RootState {
  config: {
    config: ConfigState
  }
}

const initialState: { config: ConfigState } = {
  config: {
    apiUrl: import.meta.env.VITE_API_URL as string,
    username: import.meta.env.VITE_USER_NAME as string,
    password: import.meta.env.VITE_USER_PASSWORD as string
  }
}

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    updateConfig: (state, action: PayloadAction<Partial<ConfigState>>) => {
      state.config = { ...state.config, ...action.payload }
    },
    setApiUrl: (state, action: PayloadAction<string>) => {
      state.config.apiUrl = action.payload
    },
    setCredentials: (
      state,
      action: PayloadAction<{ username: string; password: string }>
    ) => {
      const { username, password } = action.payload
      state.config.username = username
      state.config.password = password
    }
  }
})

// Export actions
export const { updateConfig, setApiUrl, setCredentials } = configSlice.actions

// Selectors
export const selectConfig = (state: RootState) => state.config.config
export const selectApiUrl = (state: RootState) => state.config.config.apiUrl
export const selectCredentials = (state: RootState) => ({
  username: state.config.config.username,
  password: state.config.config.password
})

export default configSlice.reducer
