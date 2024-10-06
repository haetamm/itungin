import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/api-default';
import axios from 'axios';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

interface LoginState {
  loading: boolean;
  error: string | null;
}

const initialState: LoginState = {
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'login/loginUser',
  async (formData: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const {data : response } = await axiosInstance.post('/auth/login', formData);
      const { data: user } = response
      Cookies.set('token', user.token, { expires: 10080 });
      localStorage.setItem('user', JSON.stringify({name: user.name, imageUrl: user.imageUrl, username: user.username, createdAt: user.createdAt}));
      toast.success(`Selamat datang ${user.name}`);
      return user;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default loginSlice.reducer;
