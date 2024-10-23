import { useState } from "react";
import CardDashboard from "../component/auth/CardDashboard";
import { Link } from "react-router-dom";
import Tabs from "../component/auth/Tabs";
import { getData } from "../utils/purchases-table-list";
import HeaderPage from "../component/auth/HeaderPage";
import { Helmet } from "react-helmet-async";

import '../styles/pages/layout-page.scss';

export default function Purchases() {
  const [currentTab, setCurrentTab] = useState('Faktur');
  const tabs = getData();

  const data = [
    { id: 1, desc: 'Pembelian belum dibayar', bg: 'bg-yellow-200', border: 'border-yellow-700', link: null },
    { id: 2, desc: 'Pembelian jatuh tempo', bg: 'bg-red-200', border: 'border-red-700', link: null },
    { id: 3, desc: 'Pelunasan diterima 30 hari terakhir', bg: 'bg-green-200', border: 'border-green-700', link: '/home' },
  ];

  return (
    <>
      <Helmet>
        <title>Itungin . Purchases</title>
        <meta name='description' content='Purchases page itungin' />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow">
        <div className="kontener-page mx-auto">
          <HeaderPage title="Pembelian">
              <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">Import</button>
              <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">Buat Pembelian</button>
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
              page="Purchases"
            />
          </div>
        </div>
      </div>
    </>
  )
}
