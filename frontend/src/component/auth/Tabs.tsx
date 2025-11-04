import { Dispatch, SetStateAction } from 'react';
import CardReport from './CardReport';
import { reportList } from '../../utils/report-list';
import TableReport from './TableReport';

import '../../styles/components/tabs.scss';

interface TabsProps {
  page: string;
  tabs: Array<reportList>;
  currentTab: string;
  setCurrentTab: Dispatch<SetStateAction<string>>;
}

export default function Tabs({
  tabs,
  currentTab,
  setCurrentTab,
  page,
}: TabsProps) {
  const categories = [...new Set(tabs.map((item) => item.category))];

  const handleTabClick = (e: React.FormEvent) => {
    setCurrentTab(e.currentTarget.id);
  };

  return (
    <div className="container text-md">
      <div className="tabs flex overflow-auto">
        {categories.map((category, index) => (
          <button
            key={index}
            id={category}
            disabled={currentTab === category}
            onClick={handleTabClick}
          >
            {category}
          </button>
        ))}
      </div>
      <div className=" px-0 py-3 md:py-6">
        {categories.map((category, index) => (
          <div
            key={index}
            className={`${page === 'Report' ? 'grid grid-cols-1 xs:grid-cols-2' : ''}`}
          >
            {currentTab === category &&
              tabs
                .filter((item) => item.category === category)
                .map((item) =>
                  item.desc ? (
                    <CardReport key={item.id} {...item} />
                  ) : (
                    <TableReport key={item.id} />
                  )
                )}
          </div>
        ))}
      </div>
    </div>
  );
}
