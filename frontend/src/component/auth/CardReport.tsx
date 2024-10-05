import { reportList } from '../../utils/report-list';

export default function CardReport({ id, title, desc }: reportList) {
  return (
    <div className=' px-1 pt-1 pb-2 mb-5 lg:mb-8 mr-0 xs:mr-4'>
      {id % 2 === 1 && (
        <>
          <div className='text-xl lg:text-2xl mb-2 font-semibold'>{title}</div>
          <div className='tex-md lg:text-lg font-normal text-justify'>{desc}</div>
          <button className='mt-3 rounded-md border-2 py-1 border-black px-3 font-normal hover:bg-white hover:border-white'>Lihat Laporan</button>
        </>
      )}
      {id % 2 === 0 && (
        <>
          <div className='text-xl lg:text-2xl mb-2 font-semibold'>{title}</div>
          <div className='tex-md lg:text-lg font-normal text-justify'>{desc}</div>
          <button className='mt-3 rounded-md border-2 py-1 border-black px-3 font-normal hover:bg-white hover:border-white'>Lihat Laporan</button>
        </>
      )}
    </div>
  )
}
