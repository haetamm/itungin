
interface HeaderPageProps {
  title: string,
  children: React.ReactNode;
}

export default function HeaderPage({ children, title }: HeaderPageProps) {
  return (
    <div  className="border-b-2 lg:border-b-4 border-black py-3">
      <div className="inline xs:flex justify-between items-center">
        <div className="mb-3 xs:mb-0">
          <div className="text-3xl">{title}</div>
        </div>
        <div className="flex xs:inline justify-end lg:justify-normal space-x-2">
          <div className="inline items-center xs:flex justify-end md:justify-normal space-y-2 space-x-2 xs:space-y-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
