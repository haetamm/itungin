import { Helmet } from "react-helmet-async";
import CardDashboard from "../component/auth/CardDashboard";
import TableCashBank from "../component/auth/TableCashBank";

import '../styles/pages/layout-page.scss';
import HeaderPage from "../component/auth/HeaderPage";

export default function CashBank() {
  const data = [
    { id: 1, desc: 'Pemasukan 30-Hari Mendatang', bg: 'bg-green-200', border: 'border-green-700', link: '' },
    { id: 2, desc: 'Pengeluaran 30-Hari Mendatang', bg: 'bg-red-200', border: 'border-red-700', link: '' },
    { id: 3, desc: 'Saldo Kas', bg: 'bg-blue-200', border: 'border-blue-700', link: '' },
    { id: 4, desc: 'Saldo Kartu Kredit', bg: 'bg-blue-200', border: 'border-blue-700', link: '' },
  ];

  return (
    <>
      <Helmet>
        <title>Itungin . Cash & Bank</title>
        <meta name='description' content='Cash & Bank page itungin' />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow mb-5">
        <div className="kontener-page mx-auto">
          <HeaderPage title="Kas & Bank">
            <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">+ Buat Akun</button>
          </HeaderPage>
          <div className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-2">
              {data.map((d, index) => (
                  <CardDashboard key={index} {...d}/>
              ))}
            </div>
          </div>
          <div  className="border-b-2 lg:border-b-4 border-black py-3 mt-5 mb-5">
            <div className="inline md:flex justify-between items-center">
              <div className="mb-3 xs:mb-0">
                <div className="text-3xl">Daftar Akun Kas</div>
                <div className="text-md justify-start items-center mt-1 ">
                  <input type="checkbox" id='arsip' className="w-7"/>
                  <label htmlFor="arsip">Tampilkan arsip akun</label>
                </div>
              </div>
              <div className="flex xs:inline justify-end lg:justify-normal space-x-2">
                <div className="inline items-center xs:flex justify-end md:justify-normal space-y-2 space-x-2 xs:space-y-0">
                  <div className="flex justify-end xs:justify-normal space-x-1">
                    <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">+ Buat Transaksi</button>
                  </div>
                  <div className="flex justify-end xs:justify-normal space-x-1">
                    <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">Peraturan Rekonsiliasi</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <TableCashBank />
        </div>
      </div>
    </>
  )
}
