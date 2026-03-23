import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import axios, { AxiosError } from 'axios'
import { apiCommonBasicDetails, apiGetEmployee } from '@/Services/Api'

/**
 * Types
 */
interface ConfigStateShape {
  apiUrl: string
  username: string
  password: string
}

interface RootState {
  config: {
    config: ConfigStateShape
  }
  hierarchy: HierarchyState
}

interface HierarchyResponsePayload {
  companies?: any[] // replace `any` with concrete types if available
  divisions?: any[]
  branches?: any[]
  departments?: any[]
  [key: string]: any
}

interface HierarchyState {
  companyDetails: any[]
  branchDetails: any[]
  divDetails: any[]
  deptDetails: any[]
  employeeData: any | null
  employeeLoading: boolean
  loading: boolean
  errors: Record<string, any>
}
interface AxiosErrorResponse {
  message?: string
  [key: string]: any
}
/**
 * Async thunk for fetching hierarchy data
 */
export const fetchHierarchyData = createAsyncThunk<
  HierarchyResponsePayload, // return value
  any, // argument (formData)
  { state: RootState; rejectValue: string }
>(
  'hierarchy/fetchHierarchyData',
  async (formData, { getState, rejectWithValue }) => {
    const { config } = getState().config
    const { apiUrl, username, password } = config || {}

    if (!apiUrl || !username || !password) {
      return rejectWithValue('Missing environment variables')
    }

    try {
      const axiosConfig = {
        auth: {
          username,
          password
        }
      }

      const response = await axios.post(apiCommonBasicDetails, formData, axiosConfig)

      const basicData = response.data
      return basicData.data as HierarchyResponsePayload
    } catch (err) {
      const error = err as AxiosError<AxiosErrorResponse>
      const message = error.response?.data?.message || error.message || 'Failed to fetch hierarchy data'
      return rejectWithValue(message)
    }
  }
)

/**
 * Async thunk for fetching employee data
 */
export const fetchEmployeeData = createAsyncThunk<
  any, // return value (employee data)
  any, // argument (formData)
  { state: RootState; rejectValue: string }
>(
  'hierarchy/fetchEmployeeData',
  async (formData, { getState, rejectWithValue }) => {
    const { config } = getState().config
    const { apiUrl, username, password } = config || {}

    if (!apiUrl || !username || !password) {
      return rejectWithValue('Missing environment variables')
    }

    try {
      const axiosConfig = {
        auth: {
          username,
          password
        }
      }

      const response = await axios.post(apiGetEmployee, formData, axiosConfig)
      const basicData = response.data
      return basicData.data
    } catch (err) {
      const error = err as AxiosError<AxiosErrorResponse>
      const message = error.response?.data?.message || error.message || 'Failed to fetch employee data'
      return rejectWithValue(message)
    }
  }
)

/**
 * Initial state
 */
const initialState: HierarchyState = {
  companyDetails: [],
  branchDetails: [],
  divDetails: [],
  deptDetails: [],
  employeeData: null,
  employeeLoading: false,
  loading: false,
  errors: {}
}

/**
 * Slice
 */
const hierarchySlice = createSlice({
  name: 'hierarchy',
  initialState,
  reducers: {
    setCompanyDetails: (state, action: PayloadAction<any[]>) => {
      state.companyDetails = action.payload
    },
    setBranchDetails: (state, action: PayloadAction<any[]>) => {
      state.branchDetails = action.payload
    },
    setDivDetails: (state, action: PayloadAction<any[]>) => {
      state.divDetails = action.payload
    },
    setDeptDetails: (state, action: PayloadAction<any[]>) => {
      state.deptDetails = action.payload
    },
    clearErrors: (state) => {
      state.errors = {}
    },
    setError: (state, action: PayloadAction<Record<string, any>>) => {
      state.errors = { ...state.errors, ...action.payload }
    },
    clearEmployeeData: (state) => {
      state.employeeData = null
      if (state.errors) state.errors.employee = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHierarchyData.pending, (state) => {
        state.loading = true
        state.errors = {}
      })
      .addCase(fetchHierarchyData.fulfilled, (state, action: PayloadAction<HierarchyResponsePayload>) => {
        state.loading = false

        const { companies, divisions, branches, departments } = action.payload || {}

        state.companyDetails = companies ?? []
        state.divDetails = divisions ?? []
        state.branchDetails = branches ?? []
        state.deptDetails = departments ?? []
      })
      .addCase(fetchHierarchyData.rejected, (state, action) => {
        state.loading = false
        state.errors.hierarchy = action.payload ?? action.error.message ?? 'Failed to fetch hierarchy data'
      })
      .addCase(fetchEmployeeData.pending, (state) => {
        state.employeeLoading = true
        if (!state.errors) state.errors = {}
        state.errors.employee = null
      })
      .addCase(fetchEmployeeData.fulfilled, (state, action: PayloadAction<any>) => {
        state.employeeLoading = false
        state.employeeData = action.payload
      })
      .addCase(fetchEmployeeData.rejected, (state, action) => {
        state.employeeLoading = false
        state.errors.employee = action.payload ?? action.error.message ?? 'Failed to fetch employee data'
        state.employeeData = null
      })
  }
})

console.log(hierarchySlice.actions)

export const {
  setCompanyDetails,
  setBranchDetails,
  setDivDetails,
  setDeptDetails,
  clearErrors,
  setError,
  clearEmployeeData
} = hierarchySlice.actions

/**
 * Selectors
 */
export const selectCompanyDetails = (state: RootState) => state.hierarchy.companyDetails
export const selectBranchDetails = (state: RootState) => state.hierarchy.branchDetails
export const selectDivDetails = (state: RootState) => state.hierarchy.divDetails
export const selectDeptDetails = (state: RootState) => state.hierarchy.deptDetails
export const selectHierarchyLoading = (state: RootState) => state.hierarchy.loading
export const selectHierarchyErrors = (state: RootState) => state.hierarchy.errors
export const selectEmployeeData = (state: RootState) => state.hierarchy.employeeData
export const selectEmployeeLoading = (state: RootState) => state.hierarchy.employeeLoading

export default hierarchySlice.reducer
