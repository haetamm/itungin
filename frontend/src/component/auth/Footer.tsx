export default function Footer() {
  return (
    <div
      className="h-[55px] p-4 my-3 mb-2 relative flex justify-center items-center rounded-md text-black"
      style={{
        background: 'var(--navbar-light-secondary)',
        boxShadow:
          'rgb(0, 0, 0) 0px -13px 14px -9px, rgb(0, 0, 0) 0px 16px 15px -9px',
      }}
    >
      <div className=" py-1 text-md">© 2023 Itungin- Online Accounting</div>
    </div>
  );
}
