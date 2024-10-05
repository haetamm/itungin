export interface serviceData {
    id: number
    img: string;
    desc: string;
}

export const getData = (): serviceData[] => {
  return [
    {
        id: 1,
        img: '/icons/sales-invoice.png',
        desc: 'Buat faktur penjualan',
    },
    {
        id: 2,
        img: '/icons/sales-order.png',
        desc: 'Buat pemesanan penjualan',
    },
    {
        id: 3,
        img: '/icons/purchase-invoice.png',
        desc: 'Buat faktur pembelian',
    },
    {
        id: 4,
        img: '/icons/product.png',
        desc: 'Tambah produk baru',
    },
    {
        id: 5,
        img: '/icons/profit-loss.png',
        desc: 'Lihat laporan laba rugi',
    },
    {
        id: 6,
        img: '/icons/expense.png',
        desc: 'Buat pencatatan biaya',
    },
  ]
}
