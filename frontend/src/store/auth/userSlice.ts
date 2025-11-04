import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie';

interface UserState {
  username: string | '';
  imageUrl: string | null;
  name: string;
  role: string;
  token: string | null;
  createdAt: string;
}

interface SetUserPayload {
  username: string;
  name: string;
  imageUrl: string | null;
}

interface SetUserImagePayload {
  imageUrl: string | null;
}

interface DecodedToken {
  name: string;
  roles: string;
}

const userData = localStorage.getItem('user');
const dataUser = userData ? JSON.parse(userData) : '';

const token = Cookies.get('token');
let decodedToken: DecodedToken | null = null;
let role = '';

if (token) {
  try {
    decodedToken = jwtDecode<DecodedToken>(token);
    role = decodedToken ? decodedToken.roles : '';
  } catch (e) {
    console.error('Invalid token', e);
  }
}

const initialState: UserState = {
  username: dataUser.username,
  imageUrl: dataUser.imageUrl,
  name: dataUser.name,
  role,
  token: token || '',
  createdAt: dataUser.createdAt,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    login(state, action: PayloadAction<UserState>) {
      state.imageUrl = action.payload.imageUrl;
      state.username = action.payload.username;
      state.name = action.payload.name;
      state.role = action.payload.role;
      state.token = action.payload.token;
      state.createdAt = action.payload.createdAt;
    },
    setUser(state, action: PayloadAction<SetUserPayload>) {
      state.username = action.payload.username;
      state.name = action.payload.name;
      state.imageUrl = action.payload.imageUrl;
    },
    setImageUser(state, action: PayloadAction<SetUserImagePayload>) {
      state.imageUrl = action.payload.imageUrl;
    },
    logout(state) {
      state.username = '';
      state.imageUrl = null;
      state.name = '';
      state.role = '';
      state.token = null;
    },
  },
});

export const { login, logout, setUser, setImageUser } = userSlice.actions;
export default userSlice.reducer;
