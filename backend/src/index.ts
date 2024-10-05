import express, { Application, Request, Response } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { errorMiddleware } from "./middleware/errorMiddleware";
import AuthRoutes from "./routers/AuthRoutes";
import dotenv from 'dotenv';
import UserRoutes from "./routers/UserRoutes";
dotenv.config();

class App {
    public app: Application;

    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.plugins();
        this.routes();
    }

    protected plugins() {
        this.app.use(cors({
            origin: 'http://localhost:3000',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }));

        this.app.use(compression());
        this.app.use(helmet());
        this.app.use(cookieParser());
    }

    protected routes(): void {
        this.app.route("/").get((res: Response) => {
            res.send('ini adalah api menggunakan typescript');
        });

        this.app.use('/api/v1/auth', AuthRoutes);
        this.app.use('/api/v1', UserRoutes);
        this.app.use(errorMiddleware);
    }
}

const port: number = 8000;
const app = new App().app;

app.listen(port, () => {
    console.log(`Aplikasi ini menggunakan port ${port}`);
});

export default app;
