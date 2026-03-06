    import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { jwtDecode } from 'jwt-decode'

/**
 * Types
 */
interface EncryptedData {
  token: string // hex string (e.g. "a3b4...")
  iv: string // hex string
}

interface DecryptArgs {
  encryptedData: EncryptedData
  secretKey: string
}

type DecryptedPayload = Record<string, any> // adjust if you have a stricter type for decrypted JSON

interface DecodeState {
  decryptedData: DecryptedPayload | null
  userData: Record<string, any>
  isLoading: boolean
  error: string | null
}

interface RootState {
  decode: DecodeState
}

/**
 * Helper: derive key bytes from a secret using PBKDF2
 */
async function deriveKeyFromSecret(
  secret: string,
  salt: string,
  iterations = 1000
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  // importKey and deriveBits use Web Crypto API types; cast some algorithm objects to any for compatibility
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' } as any,
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256'
    } as any,
    keyMaterial,
    256
  )

  return new Uint8Array(derivedBits)
}

/**
 * Async thunk for decrypting data
 */
export const decryptData = createAsyncThunk<
  DecryptedPayload, // return type on success
  DecryptArgs, // argument type
  { rejectValue: string } // thunkAPI.rejectWithValue type
>('decode/decryptData', async ({ encryptedData, secretKey }, { rejectWithValue }) => {
  try {
    const keyBytes = await deriveKeyFromSecret(secretKey, 'salt', 1000)

    // convert hex string to Uint8Array
 const encrypted = new Uint8Array(
      (encryptedData.token.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
    )
    const iv = new Uint8Array(
      (encryptedData.iv.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
    )

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes as Uint8Array<ArrayBuffer>,
      { name: 'AES-CBC' } as any,
      false,
      ['decrypt']
    )

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv } as any,
      cryptoKey,
      encrypted
    )

    const decryptedText = new TextDecoder().decode(decryptedBuffer)
    return JSON.parse(decryptedText) as DecryptedPayload
  } catch (error: any) {
    console.error('Decryption failed:', error)
    return rejectWithValue('Decryption failed: ' + (error?.message ?? String(error)))
  }
})

/**
 * Slice
 */
const initialState: DecodeState = {
  decryptedData: null,
  userData: {},
  isLoading: false,
  error: null
}

const decodeSlice = createSlice({
  name: 'decode',
  initialState,
  reducers: {
    clearDecryptedData: (state) => {
      state.decryptedData = null
      state.userData = {}
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    },
    setUserData: (state, action: PayloadAction<Record<string, any>>) => {
      state.userData = action.payload
    },
    clearUserData: (state) => {
      state.userData = {}
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(decryptData.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(decryptData.fulfilled, (state, action: PayloadAction<DecryptedPayload>) => {
        state.isLoading = false
        state.decryptedData = action.payload
        state.error = null

        if (action.payload?.token) {
          try {
            const decodedUserData: any = jwtDecode(action.payload.token)
            // adjust depending on your JWT shape
            state.userData = decodedUserData.user ?? decodedUserData
            // optional: console.log('User data automatically set:', state.userData)
          } catch (error) {
            console.error('JWT decode failed:', error)
            state.userData = {}
          }
        } else {
          // no token present
          state.userData = {}
        }
      })
      .addCase(decryptData.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? action.error.message ?? 'Unknown error'
        state.decryptedData = null
        state.userData = {}
      })
  }
})

export const { clearDecryptedData, clearError, setUserData, clearUserData } = decodeSlice.actions
export default decodeSlice.reducer

/**
 * Selectors
 */
export const selectDecryptedData = (state: RootState) => state.decode.decryptedData
export const selectIsLoading = (state: RootState) => state.decode.isLoading
export const selectError = (state: RootState) => state.decode.error
export const selectUserData = (state: RootState) => state.decode.userData
