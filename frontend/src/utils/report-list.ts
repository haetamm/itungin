export interface reportList {
    id: number
    title: string | null;
    desc: string | null;
    category: string;
}

export const getData = (): reportList[] => {
  return [
    {
        id: 1,
        title: 'Daftar penjualan',
        desc: 'Menampilkan transaksi penjualan secara kronologis berdasarkan tipenya dalam periode tertentu. Template laporan ini bisa Anda custom sesuai kebutuhan.',
        category: 'Sales',
    },
    {
        id: 2,
        title: 'Penjualan per pelanggan',
        desc: 'Menampilkan semua transaksi penjualan dari setiap pelanggan dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 3,
        title: 'Piutang pelanggan',
        desc: 'Menampilkan semua faktur yang belum dibayar dan saldo memo kredit pelanggan pada tanggal tertentu.',
        category: 'Sales',
    },
    {
        id: 4,
        title: 'Usia piutang',
        desc: 'Menampilkan total piutang dari setiap pelanggan berdasarkan usianya (30, 60, 90, dan setelah 90 hari).',
        category: 'Sales',
    },
    {
        id: 5,
        title: 'Pengiriman penjualan',
        desc: 'Menampilkan semua produk yang dikirim untuk transaksi penjualan dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 6,
        title: 'Penjualan per produk',
        desc: 'Menampilkan semua kuantitas produk yang terjual, kuantitas retur, penjualan bersih, dan harga penjualan rata-rata dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 7,
        title: 'Penyelesaian pesanan penjualan',
        desc: 'Menampilkan ringkasan proses bisnis perusahaan ini. Anda dapat mengidentifikasi setiap penyelesaian penawaran dan pesanan penjualan hingga penagihan dan pembayarannya dilakukan.',
        category: 'Sales',
    },
    {
        id: 8,
        title: 'Profitabilitas produk',
        desc: 'Menampilkan total keuntungan yang diperoleh dari produk yang terjual dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 9,
        title: 'Daftar faktur proforma',
        desc: 'Menampilkan semua faktur proforma yang dibuat dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 10,
        title: 'Daftar tukar faktur',
        desc: 'Menampilkan semua tukar faktur dalam periode tertentu.',
        category: 'Sales',
    },
    {
        id: 11,
        title: 'Daftar pembelian',
        desc: 'Menampilkan transaksi pembelian secara kronologis berdasarkan tipenya dalam periode tertentu. Template laporan ini bisa Anda custom sesuai kebutuhan.',
        category: 'Purchase',
    },
    {
        id: 12,
        title: 'Pembelian per supplier',
        desc: 'Menampilkan semua transaksi pembelian dari setiap supplier dalam periode tertentu.',
        category: 'Purchase',
    },
    {
        id: 13,
        title: 'Utang supplier',
        desc: 'Menampilkan semua faktur yang belum dibayar dan saldo memo debit supplier pada tanggal tertentu',
        category: 'Purchase',
    },
    {
        id: 14,
        title: 'Daftar pengeluaran',
        desc: 'Menampilkan semua transaksi pengeluaran dalam periode tertentu.',
        category: 'Purchase',
    },
    {
        id: 15,
        title: 'Detail pengeluaran',
        desc: 'Menampilkan semua transaksi pengeluaran berdasarkan akun dalam periode tertentu.',
        category: 'Purchase',
    },
    {
        id: 16,
        title: 'Usia utang',
        desc: 'Menampilkan total utang kepada setiap supplier berdasarkan usianya (30, 60, 90, dan setelah 90 hari).',
        category: 'Purchase',
    },
    {
        id: 17,
        title: 'Pengiriman pembelian',
        desc: 'Menampilkan semua produk yang dikirim untuk transaksi pembelian dalam periode tertent',
        category: 'Purchase',
    },
    {
        id: 18,
        title: 'Pembelian per produk',
        desc: 'Menampilkan semua kuantitas produk yang dibeli, kuantitas retur, pembelian bersih, dan harga pembelian rata-rata dalam periode tertentu.',
        category: 'Purchase',
    },
    {
        id: 19,
        title: 'Penyelesaian pesanan pembelian',
        desc: 'Menampilkan ringkasan proses bisnis perusahaan ini. Anda dapat mengidentifikasi setiap penyelesaian penawaran dan pesanan pembelian hingga penagihan dan pembayarannya dilakukan.',
        category: 'Purchase',
    },
    {
        id: 20,
        title: 'Ringkasan persediaan barang',
        desc: 'Menampilkan kuantitas stok yang tersedia dengan harga rata-rata per unit dan total nilainya pada tanggal tertentu.',
        category: 'Product',
    },
    {
        id: 22,
        title: 'Kuantitas stok gudang',
        desc: 'Menampilkan setiap kuantitas produk berdasarkan gudang yang dipilih pada tanggal tertentu.',
        category: 'Product',
    },
    {
        id: 23,
        title: 'Nilai persediaan barang',
        desc: 'Menampilkan pergerakan stok per produk berdasarkan stok yang tersedia dan nilai stoknya dalam periode tertentu.',
        category: 'Product',
    },
    {
        id: 24,
        title: 'Nilai stok gudang',
        desc: 'Menampilkan nilai persediaan barang per gudang dalam periode tertentu.',
        category: 'Product',
    },
    {
        id: 25,
        title: 'Detail persediaan barang',
        desc: 'Menampilkan daftar produk dengan mutasi dan kuantitas akhirnya.',
        category: 'Product',
    },
    {
        id: 26,
        title: 'Pergerakan barang gudang',
        desc: 'Menampilkan pergerakan stok per gudang dalam periode tertentu.',
        category: 'Product',
    },
    {
        id: 27,
        title: 'Ringkasan aset tetap',
        desc: 'Menampilkan daftar aset tetap dengan tanggal akuisisi, biaya awal, akun penyusutan, dan nilai buku.',
        category: 'Asset',
    },
    {
        id: 28,
        title: 'Detail aset tetap',
        desc: 'Menampilkan daftar aset tetap beserta nilai bukunya dalam periode tertentu.',
        category: 'Asset',
    },
    {
        id: 29,
        title: 'Penjualan atau pelepasan aset',
        desc: 'Menampilkan aset yang dijual atau dilepas dalam periode tertentu.',
        category: 'Asset',
    },
    {
        id: 30,
        title: 'Ringkasan rekonsiliasi bank',
        desc: 'Menampilkan ringkasan saldo rekening koran terekonsiliasi, serta daftar rekening laporan dan transaksi yang belum direkonsiliasi.',
        category: 'Bank',
    },
    {
        id: 31,
        title: 'Mutasi rekening koran',
        desc: 'Menampilkan daftar rekening koran, status rekonsiliasi, dan sumbernya dalam periode tertentu.',
        category: 'Bank',
    },
    {
        id: 32,
        title: 'Pajak pemotongan',
        desc: 'Menampilkan dasar pengenaan pajak (DPP), tarif pajak, dan jumlah pajak dengan tipe pemotongan yang digunakan di transaksi dalam periode tertentu.',
        category: 'Tax',
    },
    {
        id: 33,
        title: 'Pajak penjualan',
        desc: 'Menampilkan dasar pengenaan pajak (DPP), tarif pajak, dan jumlah pajak dengan pajak pertambahan nilai (PPN) yang digunakan di transaksi dalam periode tertentu',
        category: 'Tax',
    },

  ]
}
