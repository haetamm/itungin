import Tabs from '../component/auth/Tabs';
import { useState } from 'react';
import { getData } from '../utils/report-list';
import { Helmet } from 'react-helmet-async';

import '../styles/pages/layout-page.scss';

export default function Report() {
  const [currentTab, setCurrentTab] = useState('Sales');
  const tabs = getData();

  return (
    <>
      <Helmet>
        <title>Itungin . Report</title>
        <meta name='description' content='Report page itungin' />
      </Helmet>
      <div className="wrap-page overflow-auto items-center flex-grow">
        <div className="kontener-page mt-3 mx-auto">
          <Tabs
            tabs={tabs}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            page='Report'
          />
        </div>
      </div>
    </>
  )
}
