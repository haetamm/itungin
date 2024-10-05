import axios from 'axios';
import Cookies from "js-cookie";
import {jwtDecode} from 'jwt-decode';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const axiosInstance = axios.create({
    baseURL: `${apiBaseUrl}/api/v1`
});

axiosInstance.defaults.withCredentials = true;

const tokenRequiredUrls = [
    '/koac'
]

axiosInstance.interceptors.request.use((config) => {
    const token = Cookies.get("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axiosInstance.interceptors.response.use(
    async (response) => {
        const token = Cookies.get("token");

        const requestUrl = response.config.url ? new URL(response.config.url, response.config.baseURL).pathname : null;
        
        if (!requestUrl || !tokenRequiredUrls.includes(requestUrl)) {
            return response;
        }

        if (token) {
            const decodedToken = jwtDecode(token);
            const exp = decodedToken.exp;

            if (exp !== undefined) {
                const tenMinutesBeforeExp = (exp - 10 * 60) * 1000;

                if (tenMinutesBeforeExp < Date.now()) {
                    try {
                        const refreshTokenResponse = await axios.get(`${apiBaseUrl}/api/refresh`, {
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        });
                        const newToken = refreshTokenResponse.data.data.token;

                        Cookies.remove("token");
                        // Cookies.set("token", newToken, { expires: 5 / 1440 });
                        Cookies.set("token", newToken, { expires: 10080 }); // 1 minggu

                        response.headers.Authorization = `Bearer ${newToken}`;
                    } catch (error) {
                        console.error("Failed to refresh token:", error);
                        throw error;
                    }
                }
            }
        }
        return response;
    },
    (error) => {
        try {
            const { response } = error;
            if (response && response.status === 401) {
                Cookies.remove("token");
            }
        } catch (e) {
            console.error(e);
        }
        throw error;
    }
);

export default axiosInstance;
