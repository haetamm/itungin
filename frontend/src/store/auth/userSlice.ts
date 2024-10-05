import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'

interface UserState {
  username: string | "",
  name: string;
  role: string;
  token: string | null;
}

interface SetUserPayload {
  username: string;
  name: string;
}

interface DecodedToken {
  name: string;
  roles: string;
}

const userData = localStorage.getItem('user');
const dataUser = userData ? JSON.parse(userData) : "";

const token = Cookies.get('token');
let decodedToken: DecodedToken | null = null; 
let role = "";

if (token) {
  try {
    decodedToken = jwtDecode<DecodedToken>(token);
    role = decodedToken ? decodedToken.roles : "";
  } catch (e) {
    console.error('Invalid token', e);
  }
}

const initialState: UserState = {
  username: dataUser.username,
  name: dataUser.name,
  role,
  token: token || ""
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    login(state, action: PayloadAction<UserState>) {
      state.username = action.payload.username;
      state.name = action.payload.name;
      state.role = action.payload.role;
      state.token = action.payload.token;
    },
    setUser(state, action: PayloadAction<SetUserPayload>) {
      state.username = action.payload.username;
      state.name = action.payload.name;
    },
    logout(state) {
      state.username = ""
      state.name = "";
      state.role = "";
      state.token = null;
    }
  }
});

export const { login, logout, setUser } = userSlice.actions;
export default userSlice.reducer;
