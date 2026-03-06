import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios, { AxiosError } from "axios";

/* =========================
   TYPES
========================= */
export interface Screen {
  screen_id: number;
  screen_name: string;
  screen_comp: string | null;
  screen_img: string | null;
  permissions?: any[];
}

export interface SidebarResponse {
  screens: Screen[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/* =========================
   STATE TYPE
========================= */
interface SidebarState {
  data: SidebarResponse | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

/* =========================
   INITIAL STATE
========================= */
const initialState: SidebarState = {
  data: null,
  loading: false,
  error: null,
  lastFetched: null,
};

/* =========================
   ASYNC THUNK
========================= */
export const fetchSidebarData = createAsyncThunk<
  SidebarResponse,
  string, // ecno parameter
  { rejectValue: string }
>(
  "sidebar/fetchSidebarData",
  async (ecno, { rejectWithValue }) => {
    try {
      const response = await axios.get<ApiResponse<SidebarResponse>>(
        `${import.meta.env.VITE_API_URL}/api/user_approval/get_user_screens_and_permisssions/${ecno}`
      );

      console.log(response.data.data,ecno);
      return response?.data?.data;
    } catch (err) { 
      const error = err as AxiosError;
      return rejectWithValue(
        (error.response?.data as string) || "Failed to fetch sidebar data"
      );
    }
  }
);

/* =========================
   SLICE
========================= */
const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    clearSidebarData: (state) => {
      state.data = null;
      state.lastFetched = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSidebarData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchSidebarData.fulfilled,
        (state, action: PayloadAction<SidebarResponse>) => {
          state.loading = false;
          state.data = action.payload;
          state.lastFetched = Date.now();
        }
      )
      .addCase(fetchSidebarData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Something went wrong";
      });
  },
});

/* =========================
   EXPORTS
========================= */
export const { clearSidebarData } = sidebarSlice.actions;
export default sidebarSlice.reducer;

/* =========================
   SELECTORS
========================= */
export const selectSidebarData = (state: any) => state.sidebar.data;
export const selectSidebarLoading = (state: any) => state.sidebar.loading;
export const selectSidebarError = (state: any) => state.sidebar.error;
