
interface CardDashboardProps {
  id: number,
  desc: string,
  border: string,
  bg: string,
  link: string | null
}

export default function CardDashboard({border, bg, desc }: CardDashboardProps) {
  return (
    <div className={`${border} border-l-4`}>
      <div className={`${bg}  flex space-x-1 xl:space-x-2 items-center justify-between px-2 h-[65px]`}>
        <p>{desc}</p>
        <div className={`${bg} px-1 text-white rounded-md text-center`}>0</div>
      </div>
      <div className="items-center flex px-2 h-[65px] bg-white">
        <div>
          <small>Total</small>
          <p>Rp. 0,-</p>
        </div>
      </div>
    </div>
  )
}
