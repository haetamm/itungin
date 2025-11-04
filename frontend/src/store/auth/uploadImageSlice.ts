import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/api-default';
import { toast } from 'sonner';
import axios from 'axios';

interface UpdateState {
  loading: boolean;
  error: string | null;
}

const initialState: UpdateState = {
  loading: false,
  error: null,
};

export const uploadImage = createAsyncThunk(
  'upload/uploadImage',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const { data: response } = await axiosInstance.put(
        '/user/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      const { data: user } = response;
      toast.success('Profile image successfully updated');
      const dataImage = localStorage.getItem('user');
      if (dataImage) {
        const userImage = JSON.parse(dataImage);
        userImage.imageUrl = user.imageUrl;
        localStorage.setItem('user', JSON.stringify(userImage));
      }
      return user;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue('An unexpected error occurred');
    }
  }
);

const uploadImageSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(uploadImage.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(uploadImage.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(uploadImage.rejected, (state, action) => {
      ((state.loading = false), (state.error = action.payload as string));
    });
  },
});

export default uploadImageSlice.reducer;
