import '../../styles/components/table-reports.scss';

const TheadComp = () => {
  return (
    <tr>
      <th className="bg-white"></th>
      <td>Kode Akun</td>
      <td>Nama Akun</td>
      <td>Saldo Bank</td>
      <td>Saldo di Jurnal</td>
      <td>Tindakan</td>
      <th className="hidden md:block"></th>
    </tr>
  );
};

export default function Table() {
  const data = ['Kas', 'Rekening Bank', 'Giro'];
  return (
    <div className="overflow-x-auto bg-white max-h-[300px]">
      <table className="table table-md table-pin-rows table-pin-cols ">
        <thead className="text-sm">
          <TheadComp />
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <th className="bg-white">{index + 1}</th>
              <td>1-1000{index + 1}</td>
              <td>{item}</td>
              <td>0,00</td>
              <td>0,00</td>
              <td>12/16/2020</td>
              <th className="hidden md:block">{index + 1}</th>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <TheadComp />
        </tfoot>
      </table>
    </div>
  );
}
