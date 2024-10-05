import axiosInstance from "./api-default";

export interface FormData {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) {
        return "Invalid date";
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return "Invalid date";
    }

    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day} ${getMonthName(date.getMonth())} ${year}`;
}

const getMonthName = (monthIndex: number): string => {
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[monthIndex];
}

export const getUser = async () => {
    const response = await axiosInstance.get('/user');
    return response.data.data;
};

export const updateUser = async (payload: FormData) => {
    const response = await axiosInstance.put('/user', payload);
    return response.data.data;
};

export const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);

    if (!match) {
        throw new Error('Invalid data URL');
    }

    const mime = match[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], {type: mime});
}
