import BaseRoutes from "./base/BaseRouter";
import { authMiddleware } from "../middleware/authMiddleware";
import SupplierController from "../controllers/supplier/SupplierController";

class SupplierRoutes extends BaseRoutes {
    public routes(): void {
        this.router.get('/suppliers', authMiddleware, SupplierController.getAllSupplier);
        this.router.post('/suppliers', authMiddleware, SupplierController.createSupplier);
        this.router.get('/suppliers/:id', authMiddleware, SupplierController.getSupplierById);
        this.router.put('/suppliers/:id', authMiddleware, SupplierController.updateSupplierById);
        this.router.delete('/suppliers/:id', authMiddleware, SupplierController.deleteSupplierById);
    }
}

export default new SupplierRoutes().router;