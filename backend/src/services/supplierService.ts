import { PaginationResponse, SupplierForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { Prisma, Supplier } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { formSupplier } from '../validation/suplierValidation';
import { supplierRepository } from '../repository/supplierRepository';

export class SupplierService {
  async getAllSupplier(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ): Promise<PaginationResponse<Supplier, 'suppliers'>> {
    if (page < 1 || limit < 1) {
      throw new ResponseError(400, 'Halaman dan batas harus bilangan positif');
    }
    const { suppliers, total } = await supplierRepository.getAllSupplier(
      page,
      limit,
      search
    );

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createSupplier({ body }: { body: SupplierForm }): Promise<Supplier> {
    const supplierReq = validate(formSupplier, body);
    const suplier = await supplierRepository.createSupplier(supplierReq);
    return suplier;
  }

  async updateSupplierById(
    { body }: { body: SupplierForm },
    id: string
  ): Promise<Supplier> {
    const supplierReq = validate(formSupplier, body);
    const { supplierId } = await this.getSupplierById(id);
    const supplier = await supplierRepository.updateSupplierById(
      supplierId,
      supplierReq
    );
    return supplier;
  }

  async getSupplierById(id: string) {
    const supplier = await supplierRepository.findSupplierById(id);
    if (!supplier) throw new ResponseError(404, 'Supplier not found');
    return supplier;
  }

  async deleteProductById(id: string) {
    const { supplierId } = await this.getSupplierById(id);
    await supplierRepository.deleteSupplierById(supplierId);
  }

  async getSupplierTransaction(
    id: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const supplier = await supplierRepository.findSupplierTransaction(
      id,
      prismaTransaction
    );
    if (!supplier) throw new ResponseError(404, 'Supplier not found');
    return supplier;
  }
}

export const supplierService = new SupplierService();
