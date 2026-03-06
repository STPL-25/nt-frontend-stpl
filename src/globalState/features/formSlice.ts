import { createSlice, PayloadAction } from '@reduxjs/toolkit'

/**
 * Types
 */
export interface FormState {
  formData: any | null           // Change `any` to your form type if needed
  errors: Record<string, string> // { fieldName: "Error message" }
}

export interface RootState {
  form: FormState
}

/**
 * Initial State
 */
const initialState: FormState = {
  formData: null,
  errors: {}
}

/**
 * Slice
 */
const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    setFormData: (state, action: PayloadAction<any>) => {
      state.formData = action.payload
    },
    clearFormErrors: (state) => {
      state.errors = {}
    },
    setFormError: (state, action: PayloadAction<Record<string, string>>) => {
      state.errors = { ...state.errors, ...action.payload }
    },
    resetForm: (state) => {
      state.formData = null
      state.errors = {}
    }
  }
})

export const { setFormData, clearFormErrors, setFormError, resetForm } =
  formSlice.actions

/**
 * Selectors
 */
export const selectFormData = (state: RootState) => state.form.formData
export const selectFormErrors = (state: RootState) => state.form.errors

export default formSlice.reducer
