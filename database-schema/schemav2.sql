CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    stock_quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT,
    purchase_date DATE,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales (
    sales_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    sale_date DATE,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE liabilities (
    liability_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT,
    supplier_id INT,
    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE,
    status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

CREATE TABLE receivables (
    receivable_id INT AUTO_INCREMENT PRIMARY KEY,
    sales_id INT,
    customer_id INT,
    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE,
    status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
    FOREIGN KEY (sales_id) REFERENCES sales(sales_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    expense_date DATE
);

CREATE TABLE cash_in_journal (
    cash_in_id INT AUTO_INCREMENT PRIMARY KEY,
    sales_id INT NULL,          -- relasi dengan transaksi penjualan tunai
    receivable_id INT NULL,     -- relasi dengan pembayaran piutang
    customer_id INT,
    transaction_date DATE,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    FOREIGN KEY (sales_id) REFERENCES sales(sales_id),
    FOREIGN KEY (receivable_id) REFERENCES receivables(receivable_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE cash_out_journal (
    cash_out_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NULL,      -- relasi dengan transaksi pembelian tunai
    liability_id INT NULL,     -- relasi dengan pembayaran utang
    expense_id INT NULL,       -- relasi dengan pengeluaran beban
    supplier_id INT,
    transaction_date DATE,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id),
    FOREIGN KEY (liability_id) REFERENCES liabilities(liability_id),
    FOREIGN KEY (expense_id) REFERENCES expenses(expense_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

CREATE TABLE sales_details (
    sale_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    sales_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (sales_id) REFERENCES sales(sales_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE purchase_details (
    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);