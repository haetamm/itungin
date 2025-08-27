import { Supplier } from '@prisma/client';
import { prismaClient } from '../application/database';
import { SupplierForm } from '../utils/interface';
import { paginate } from '../utils/pagination';

export class SupplierRepository {
  async getAllSupplier(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ): Promise<{ suppliers: Supplier[]; total: number }> {
    const searchFilter = search
      ? {
          OR: [
            { supplierName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const result = await paginate<Supplier>(prismaClient.supplier, {
      page,
      limit,
      where: searchFilter,
      orderBy: { createdAt: 'desc' },
    });

    return { suppliers: result.items, total: result.total };
  }

  async findSupplierById(supplierId: string): Promise<Supplier | null> {
    return await prismaClient.supplier.findUnique({
      where: { supplierId, deletedAt: null },
    });
  }

  async createSupplier(data: SupplierForm): Promise<Supplier> {
    return prismaClient.supplier.create({
      data: data,
    });
  }

  async updateSupplierById(
    supplierId: string,
    data: SupplierForm
  ): Promise<Supplier> {
    return await prismaClient.supplier.update({
      where: { supplierId },
      data: {
        ...data,
      },
    });
  }

  async deleteSupplierById(supplierId: string): Promise<void> {
    await prismaClient.supplier.update({
      where: { supplierId },
      data: { deletedAt: new Date() },
    });
  }
}

export const supplierRepository = new SupplierRepository();
