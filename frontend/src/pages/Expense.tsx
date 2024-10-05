import { useState } from "react";
import CardDashboard from "../component/auth/CardDashboard";
import { Link } from "react-router-dom";
import Tabs from "../component/auth/Tabs";
import HeaderPage from "../component/auth/HeaderPage";
import { Helmet } from "react-helmet-async";

import '../styles/pages/layout-page.scss';

export default function Purchases() {
  const [currentTab, setCurrentTab] = useState('Biaya');
  const tabs = [
    {
      id: 1,
      title: null,
      desc: null,
      category: 'Biaya',
    },
    {
      id: 2,
      title: null,
      desc: null,
      category: 'Persetujuan',
    },
  ];

  const data = [
    { id: 1, desc: 'Total Biaya Bulan Ini', bg: 'bg-blue-200', border: 'border-blue-700', link: '/home' },
    { id: 2, desc: 'Biaya 30 Hari Terakhir', bg: 'bg-blue-200', border: 'border-blue-700', link: '/home' },
    { id: 3, desc: 'Biaya Belum Dibayar', bg: 'bg-blue-200', border: 'border-blue-700', link: '/home' },
  ];

  return (
    <>
      <Helmet>
        <title>Itungin . Expense</title>
        <meta name='description' content='Expense page itungin' />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow">
        <div className="kontener-page mx-auto">
          <HeaderPage title="Pengeluaran">
            <div className="flex justify-end xs:justify-normal space-x-1">
              <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">Buat Biaya</button>
            </div>
          </HeaderPage>
          <div className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-2">
              {data.map((d, index) => (
                d.link ? (
                  <Link key={index} to={d.link} >
                    <CardDashboard {...d} />
                  </Link>
                ) : (
                  <CardDashboard key={index} {...d} />
                )
              ))}
            </div>
          </div>
          <div className="mt-10">
            <Tabs
              tabs={tabs}
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              page="Biaya"
            />
          </div>
        </div>
      </div>
    </>
  )
}
