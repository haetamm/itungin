import { Supplier } from "@prisma/client";
import { prismaClient } from "../application/database";
import { SupplierForm } from "../utils/interface";

export class SupplierRepository {
    async findSupplierById(id: string): Promise<Supplier | null> {
        return await prismaClient.supplier.findUnique({
            where: { id, deletedAt: null }
        });
    }

    async createSupplier(data: SupplierForm): Promise<Supplier> {
        return prismaClient.supplier.create({
            data: data
        });
    }

    async updateSupplierById(id: string, data: SupplierForm): Promise<Supplier>  {
        return await prismaClient.supplier.update({
            where: { id },
            data: {
                ...data
            }
        });
    }
    
    async deleteSupplierById(id: string): Promise<void> {
        await prismaClient.supplier.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async getAllSupplier() {
        return await prismaClient.supplier.findMany({
            where: { deletedAt: null }
        });
    }
}

export const supplierRepository = new SupplierRepository();
