import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import Cookies from "js-cookie";
import { NotifSetting, UserData, modalSetting } from "../utils/dataInterface";

interface StateContextProps {
  user: null | UserData;
  token: null | string;
  notification: null | NotifSetting;
  openModal: modalSetting;
  setUser: Dispatch<SetStateAction<UserData>>;
  setToken: (token: string | null) => void;
  setNotification: (message: string | null, setting: string | null) => void;
  setOpenModal: (modal: modalSetting) => void;
}

const StateContext = createContext<StateContextProps>({
  user: null,
  token: null,
  notification: null,
  openModal: { toggle: false, setting: "" },
  setUser: () => {},
  setToken: () => { },
  setNotification: () => { },
  setOpenModal: () => {},
});

interface ContextProviderProps {
  children: ReactNode;
}

export const ContextProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [openModal, setOpenModal] = useState<modalSetting>({
    toggle: false,
    setting: ""
  });

  const handleSetOpenModal = (modal: modalSetting) => {
    setOpenModal(modal);
  }

  const [user, setUser] = useState<UserData>({
    id: 0,
    image: "",
    name: "",
    email: "",
    created_at: "",
    updated_at: ""
  });
  const [token, _setToken] = useState<string | null>(Cookies.get("token") ?? null);
  const [notification, _setNotification] = useState<NotifSetting | null>({
    message: '',
    setting: '',
  });

  const setToken = (newToken: string | null) => {
    _setToken(newToken);

    if (newToken) {
      Cookies.set("token", newToken, { expires: 10080 }); // 1minggu
    } else {
      Cookies.remove("token");
    }
  };

  const setNotification = (message: string | null, setting: string | null) => {
    _setNotification({
      message: message || '',
      setting: setting || '',
    });
    setTimeout(() => {
      _setNotification(null)
    }, 5000)
  }

  return (
    <StateContext.Provider
      value={{
        user,
        token,
        notification,
        openModal,
        setUser,
        setToken,
        setNotification,
        setOpenModal: handleSetOpenModal
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export const useStateContext = () => useContext(StateContext);
