import HeaderPage from "../component/auth/HeaderPage";
import { Helmet } from "react-helmet-async";

import '../styles/pages/layout-page.scss';
import { productColumns } from "../utils/columnTable";
import Table from "../component/auth/Table";

export default function Product() {

  return (
    <>
      <Helmet>
        <title>Itungin . Product</title>
        <meta name='description' content='Product page itungin' />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow">
        <div className="kontener-page mx-auto">
          <HeaderPage title="Products">
              <button className="py-2 px-3 border-2 rounded-md border-slate-300 text-center hover:bg-white hover:border-white">Tambah Product</button>
          </HeaderPage>
          <div className="mt-5">
           <Table columns={productColumns} />
        </div>
      </div>
      </div>
    </>
  )
}
