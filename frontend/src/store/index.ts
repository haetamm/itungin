import { configureStore } from '@reduxjs/toolkit';
import loginReducer from './guest/loginSlice';
import registerReducer from './guest/registerSlice';
import userReducer from './auth/userSlice';
import modalReducer from './auth/modalSlice';
import updateUserSlice from './auth/userUpdateSlice';

export const store = configureStore({
  reducer: {
    login: loginReducer,
    register: registerReducer,
    user: userReducer,
    modal: modalReducer,
    userUpdate: updateUserSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
