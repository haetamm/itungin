import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance from "../../utils/api-default";
import { toast } from "sonner";
import axios from "axios";

interface UpdateState {
    loading: boolean;
    error: string | null;
}

interface formUpdate {
    name: string,
    username: string,
    password: string | null,
}

const initialState: UpdateState = {
    loading: false,
    error: null,
}

export const updateUser = createAsyncThunk(
    'update/updateUser',
    async (formData: formUpdate, { rejectWithValue }) => {
        try {
            const { data: response } = await axiosInstance.put('/user', formData);
            const { data: user } = response;
            // console.log(user)
            toast.success(`Selamat ${user.name}, profile telah diupdate`);
            return user;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response){
                return rejectWithValue(error.response.data);
            }
            return rejectWithValue('An unexpected error occurred');
        }
    }
)

const updateUserSlice = createSlice({
    name: 'update',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(updateUser.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(updateUser.fulfilled, (state) => {
            state.loading = false;
        });
        builder.addCase(updateUser.rejected, (state, action) => {
            state.loading = false,
            state.error = action.payload as string;
        });
    },
});

export default updateUserSlice.reducer;