import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios, { AxiosError } from "axios";

/* =========================
   TYPES
========================= */
export type Branch = {
  brn_sno: string;
  brn_name: string;
};

export type Division = {
  div_sno: string;
  div_name: string;
  branches: Branch[];
};

export type Company = {
  com_sno: string;
  com_name: string;
  divisions: Division[];
};

export interface HierarchyResponse {
  companies: Company[];
}

/* =========================
   STATE TYPE
========================= */
interface HierarchyState {
  data: HierarchyResponse | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

/* =========================
   INITIAL STATE
========================= */
const initialState: HierarchyState = {
  data: null,
  loading: false,
  error: null,
  lastFetched: null,
};
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* =========================
   ASYNC THUNK
========================= */
export const fetchHierarchy = createAsyncThunk<
  HierarchyResponse,  void,  { rejectValue: string }>( "hierarchy/fetchHierarchy",  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<ApiResponse<HierarchyResponse>>(
        `${import.meta.env.VITE_API_URL}/api/user_approval/get_hierachy_com_details`
      );
      return response?.data?.data;
    } catch (err) {
      const error = err as AxiosError;
      return rejectWithValue(
        (error.response?.data as string) || "Failed to fetch hierarchy"
      );
    }
  }
);
/* =========================
   SLICE
========================= */
const hierarchyCompanyDetailsSlice = createSlice({
  name: "hierarchyCompanyDetails",
  initialState,
  reducers: {
    clearHierarchy: (state) => {
      state.data = null;
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHierarchy.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchHierarchy.fulfilled,
        (state, action: PayloadAction<HierarchyResponse>) => {
          state.loading = false;
          state.data = action.payload;
          state.lastFetched = Date.now();
        }
      )
      .addCase(fetchHierarchy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Something went wrong";
      });
  },
});

/* =========================
   EXPORTS
========================= */
export const { clearHierarchy } = hierarchyCompanyDetailsSlice.actions;
export default hierarchyCompanyDetailsSlice.reducer;

/* =========================
   SELECTORS (OPTIONAL BUT USEFUL)
========================= */
export const selectCompanyHierarchy = (state: any) => state.hierarchyCompanyDetails.data;
export const selectCompanyHierarchyLoading = (state: any) => state.hierarchyCompanyDetails.loading;
export const selectCompanyHierarchyError = (state: any) => state.hierarchyCompanyDetails.error;

