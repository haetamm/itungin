import { toast } from 'sonner';
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance from "../../utils/api-default";
import axios from "axios";


interface RegisterState {
    loading: boolean;
    error: string | null;
}

interface formRegister {
    name: string,
    username: string,
    password: string,
}

const initialState: RegisterState = {
    loading: false,
    error: null,
}

export const registerUser = createAsyncThunk(
    'register/registerUser',
    async (formData: formRegister, { rejectWithValue }) => {
        try {
            const { data: response } = await axiosInstance.post('/auth/regis', formData);
            const { data: user } = response;
            toast.success(`Silahkan login ${user.name}`);
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response){
                return rejectWithValue(error.response.data);
            }
            return rejectWithValue('An unexpected error occurred');
        }
    }
)

const registerSlice = createSlice({
    name: 'register',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(registerUser.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(registerUser.fulfilled, (state) => {
            state.loading = false;
        });
        builder.addCase(registerUser.rejected, (state, action) => {
            state.loading = false,
            state.error = action.payload as string;
        });
    },
});

export default registerSlice.reducer;