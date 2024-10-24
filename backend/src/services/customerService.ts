import { Customer } from "@prisma/client";
import { CustomerForm } from "../utils/interface";
import { validate } from "../validation/validation";
import { customerRepository } from "../repository/customerRepository";
import { formCustomer } from "../validation/customerValidation";
import { ResponseError } from "../entities/responseError";


export class CustomerService {

    async createCustomer({ body }: { body: CustomerForm }): Promise<Customer> {
        const customerReq = validate(formCustomer, body);
        const customer = await customerRepository.createCustomer(customerReq);
        return customer;
    }

    async updateCustomerById({ body }: { body: CustomerForm }, id: string): Promise<Customer> {
        const customerReq = validate(formCustomer, body);
        const { id: customerId }  = await this.getCustomerById(id);
        const customer = await customerRepository.updateCustomerById(customerId, customerReq);
        return customer;
    }

    async getCustomerById(id: string) {
        const customer = await customerRepository.findCustomerById(id);
        if (!customer) throw new ResponseError(404, "Customer not found");
        return customer;
    }

    async getAllCustomer() {
        const customers = await customerRepository.getAllCustomer();
        return customers;
    }

    async deleteCustomerById(id: string) {
        const { id: customerId } = await this.getCustomerById(id);
        await customerRepository.deleteCustomerById(customerId);
        
    }

}

export const customerService = new CustomerService();
