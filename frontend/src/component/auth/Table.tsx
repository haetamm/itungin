import { columnTable } from '../../utils/dataInterface';

interface THeadProps {
  columns: columnTable[];
}

const Thead = ({ columns }: THeadProps) => {
  return (
    <tr>
      <th className="bg-white">No.</th>
      {columns.map((column, index) => (
        <td key={index}>{column.label}</td>
      ))}
    </tr>
  );
};

export default function Table({ columns }: THeadProps) {
  return (
    <>
      <div className="overflow-x-auto bg-white max-h-[430px] xs:max-h-[250px] md:max-h-[500px]">
        <table className="table table-zebra table-md table-pin-rows table-pin-cols font-normal">
          <thead>
            <Thead columns={columns} />
          </thead>
          {/* <tbody>
                    {loading ? ( 
                        <tr>
                        <td colSpan={columns.length + 1}>
                            Loading...
                        </td>
                        </tr>
                    ) : data && data.length > 0 ? (
                        data.map((item, rowIndex) => (
                        <tr key={rowIndex}>
                            <th>{rowIndex + 1}</th>
                            {columns.map((column, colIndex) => (
                            <td key={colIndex}>
                                {column.key === 'action' ? (
                                item[column.key].map((action, actionIndex) => (
                                    <button
                                    onClick={() => { handleAction(action, item) }}
                                    key={actionIndex}
                                    className={getActionClass(action)}
                                    >
                                    {action}
                                    </button>
                                ))
                                ) : (
                                item[column.key]
                                )}
                            </td>
                            ))}
                        </tr>
                        ))
                    ) : (
                        <tr>
                        <td colSpan={columns.length + 1}>Data not available</td>
                        </tr>
                    )}
                    </tbody> */}
        </table>
      </div>
    </>
  );
}
