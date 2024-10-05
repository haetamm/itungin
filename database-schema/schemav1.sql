DROP TABLE IF EXISTS accounts;

CREATE TABLE accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20),
    account_name VARCHAR(50) NOT NULL,  -- Nama akun (cash, piutang, hutang, dll)
    account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'SALES', 'PURCHASES', 'EXPENSE') NOT NULL,  -- Tipe akun (Aset, Kewajiban, Ekuitas, Pendapatan, Beban)
    balance DECIMAL(15, 2) DEFAULT 0.00
);

DROP TABLE IF EXISTS entries;

CREATE TABLE entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    transaction_date DATE NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(15, 2) DEFAULT 0.00,
    debitCredit ENUM('DEBIT', 'CREDIT' ) NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

DROP TABLE IF EXISTS suppliers;

CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    address TEXT 
);

DROP TABLE IF EXISTS products;

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(15, 2) NOT NULL,
    stock INT NOT NULL
);

DROP TABLE IF EXISTS purchases;

CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT,
    purchase_date DATE,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

DROP TABLE IF EXISTS purchase_details;

CREATE TABLE purchase_details (
    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

DROP TABLE IF EXISTS payables;

CREATE TABLE payables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    supplier_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (entry_id) REFERENCES entries(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    address TEXT
);

DROP TABLE IF EXISTS sales;

CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    sale_date DATE,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_status ENUM('PAID', 'UNPAID') DEFAULT 'UNPAID',
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

DROP TABLE IF EXISTS sales_details;

CREATE TABLE sales_details (
    sale_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    sales_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (sales_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

DROP TABLE IF EXISTS receivables;

CREATE TABLE receivables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE NOT NULL, 
    status ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

DROP TABLE IF EXISTS equity;

CREATE TABLE equity (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description VARCHAR(255),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

DROP TABLE IF EXISTS expenses;

CREATE TABLE expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description VARCHAR(255),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);



-- Tabel ini mencatat semua pendapatan yang diterima oleh warung.
-- CREATE TABLE revenues (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     entry_id INT NOT NULL,            -- Mengacu pada tabel transaksi umum
--     product_id INT,                         -- Mengacu pada tabel produk jika ada
--     quantity INT DEFAULT 1,                 -- Jumlah barang yang dijual
--     unit_price DECIMAL(15, 2),              -- Harga satuan barang yang dijual
--     total_amount DECIMAL(15, 2) NOT NULL,   -- Total pendapatan dari penjualan
--     description VARCHAR(255),               -- Deskripsi singkat tentang penjualan
--     sale_date DATE NOT NULL,                -- Tanggal penjualan
--     FOREIGN KEY (entry_id) REFERENCES entries(id)
-- );