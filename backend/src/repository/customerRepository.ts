import { Customer } from "@prisma/client";
import { prismaClient } from "../application/database";
import { CustomerForm } from "../utils/interface";

export class CustomerRepository {
    async findCustomerById(id: string): Promise<Customer | null> {
        return await prismaClient.customer.findUnique({
            where: { id, deletedAt: null }
        });
    }

    async createCustomer(data: CustomerForm): Promise<Customer> {
        return prismaClient.customer.create({
            data: data
        });
    }

    async updateCustomerById(id: string, data: CustomerForm): Promise<Customer>  {
        return await prismaClient.customer.update({
            where: { id },
            data: {
                ...data
            }
        });
    }
    
    async deleteCustomerById(id: string): Promise<void> {
        await prismaClient.customer.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async getAllCustomer() {
        return await prismaClient.customer.findMany({
            where: { deletedAt: null }
        });
    }
}

export const customerRepository = new CustomerRepository();
