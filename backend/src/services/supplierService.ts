import { SupplierForm } from "../utils/interface";
import { validate } from '../validation/validation';
import { Supplier } from '@prisma/client';
import { ResponseError } from "../entities/responseError";
import { formSupplier } from "../validation/suplierValidation";
import { supplierRepository } from "../repository/supplierRepository";

export class SupplierService {

    async createSupplier({ body }: { body: SupplierForm }): Promise<Supplier> {
        const supplierReq = validate(formSupplier, body);
        const suplier = await supplierRepository.createSupplier(supplierReq);
        return suplier;
    }

    async updateSupplierById({ body }: { body: SupplierForm }, id: string): Promise<Supplier> {
        const supplierReq = validate(formSupplier, body);
        const supplierRes  = await this.getSupplierById(id);
        const supplier = await supplierRepository.updateSupplierById(supplierRes.id, supplierReq);
        return supplier;
    }

    async getSupplierById(id: string) {
        const supplier = await supplierRepository.findSupplierById(id);
        if (!supplier) throw new ResponseError(404, "Supplier not found");
        return supplier;
    }

    async getAllSupplier() {
        const supplier = await supplierRepository.getAllSupplier();
        return supplier;
    }

    async deleteProductById(id: string) {
        const { id: supplierId } = await this.getSupplierById(id);
        await supplierRepository.deleteSupplierById(supplierId);
        
    }

}

export const supplierService = new SupplierService();
