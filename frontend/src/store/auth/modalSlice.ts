import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ModalState {
  type: string;
  isOpen: boolean;
}

const initialState: ModalState = {
  type: '',
  isOpen: false,
};

const modalSlice = createSlice({
  name: 'modal',
  initialState,
  reducers: {
    openModal(state, action: PayloadAction<ModalState>) {
      state.type = action.payload.type;
      state.isOpen = true;
    },
    closeModal(state) {
      ((state.isOpen = false), (state.type = ''));
    },
  },
});

export const { openModal, closeModal } = modalSlice.actions;
export default modalSlice.reducer;
