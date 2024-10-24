import express, { Application, Request, Response } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import AuthRoutes from "../routers/AuthRoutes";
import { errorMiddleware } from "../middleware/errorMiddleware";
import UserRoutes from "../routers/UserRoutes";
import ProductsRoutes from "../routers/ProductsRoutes";
import SupplierRoutes from "../routers/SupplierRoutes";
import CustomerRoutes from "../routers/CustomerRoutes";

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
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }));
    
        this.app.use(compression());
        this.app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
        this.app.use(cookieParser());

    }

    protected routes(): void {
        this.app.route("/").get((res: Response) => {
            res.send('ini adalah api menggunakan typescript');
        });

        this.app.use('/api/v1/auth', AuthRoutes);
        this.app.use('/api/v1', UserRoutes);
        this.app.use('/api/v1', ProductsRoutes);
        this.app.use('/api/v1', SupplierRoutes);
        this.app.use('/api/v1', CustomerRoutes);
        this.app.use(errorMiddleware);
    }
}

export default App;