import express, { Application, Response, Request } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import AuthRoutes from '../routers/AuthRoutes';
import { errorMiddleware } from '../middleware/errorMiddleware';
import UserRoutes from '../routers/UserRoutes';
import ProductsRoutes from '../routers/ProductsRoutes';
import SupplierRoutes from '../routers/SupplierRoutes';
import VatRoutes from '../routers/VatRoutes';
import GeneralSettingRoutes from '../routers/GeneralSettingRoutes';
import AccountRoutes from '../routers/AccountRoutes';
import PurchaseRoutes from '../routers/PurchaseRoutes';
import CustomerRoutes from '../routers/CustomerRoutes';
import SaleRoutes from '../routers/SaleRoutes';
import PurchaseDetailRoutes from '../routers/PurchaseDetailRoutes';
import SaleDetailRoutes from '../routers/SaleDetailRoutes';

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
    this.app.use(
      cors({
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      })
    );

    this.app.use(compression());
    this.app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
    this.app.use(cookieParser());
  }

  protected routes(): void {
    this.app.route('/').get((_req: Request, res: Response) => {
      res.status(200).json('ini adalah api menggunakan typescript');
    });

    this.app.use('/api/v1/auth', AuthRoutes);
    this.app.use('/api/v1', UserRoutes);
    this.app.use('/api/v1', ProductsRoutes);
    this.app.use('/api/v1', SupplierRoutes);
    this.app.use('/api/v1', VatRoutes);
    this.app.use('/api/v1', GeneralSettingRoutes);
    this.app.use('/api/v1', AccountRoutes);
    this.app.use('/api/v1', PurchaseRoutes);
    this.app.use('/api/v1', PurchaseDetailRoutes);
    this.app.use('/api/v1', CustomerRoutes);
    this.app.use('/api/v1', SaleRoutes);
    this.app.use('/api/v1', SaleDetailRoutes);
    this.app.use(errorMiddleware);
  }
}

export default App;
