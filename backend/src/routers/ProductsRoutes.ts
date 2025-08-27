import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import ProductController from '../controllers/product/ProductController';

class ProductRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/products',
      authMiddleware,
      ProductController.getAllProduct
    );

    this.router.post(
      '/products',
      authMiddleware,
      ProductController.createProduct
    );

    this.router.get(
      '/products/:id',
      authMiddleware,
      ProductController.getProductById
    );

    this.router.put(
      '/products/:id',
      authMiddleware,
      ProductController.updateProductById
    );

    this.router.delete(
      '/products/:id',
      authMiddleware,
      ProductController.deleteProductById
    );
  }
}

export default new ProductRoutes().router;
