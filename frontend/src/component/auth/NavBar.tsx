import { useState } from 'react';
import { IoPricetagsSharp } from 'react-icons/io5';
import { RiCurrencyFill } from 'react-icons/ri';
import { FaRegUserCircle, FaShoppingCart } from 'react-icons/fa';
import { GoTriangleUp } from 'react-icons/go';
import { TbGridDots } from "react-icons/tb";
import { MdAccessTime, MdOutlineLiveHelp } from 'react-icons/md';
import { IoMdLogOut, IoMdNotificationsOutline } from "react-icons/io";
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { openModal } from '../../store/auth/modalSlice';

import '../../styles/components/navbar.scss';

export default function NavBar() {
  const dispatch = useDispatch<AppDispatch>();
  const { name } = useSelector((state: RootState) => state.user);
  const [openDropdown, setOpenDropdown] = useState(false);
  const isActive = useLocation().pathname === '/profile';

  const handleDropdownToggle = () => {
    setOpenDropdown(!openDropdown);
  };

  const handleOpenModal = () => {
    dispatch(openModal({
      type: 'small',
      isOpen: true
    }));
  };

  const navItems = [
    { label: 'Sales', icon: <IoPricetagsSharp /> },
    { label: 'Purchases', icon: <FaShoppingCart /> },
    { label: 'Expense', icon: <RiCurrencyFill /> }
  ];

  const actionIcons = [
    <TbGridDots key="grid" className="h-7 w-7 cursor-pointer hover:text-blue-400" />,
    <MdOutlineLiveHelp key="help" className="h-7 w-7 cursor-pointer hover:text-blue-400" />,
    <MdAccessTime key="time" className="h-7 w-7 cursor-pointer hover:text-blue-400" />,
    <IoMdNotificationsOutline key="notifications" className="h-7 w-7 cursor-pointer hover:text-blue-400" />
  ];

  return (
    <>
      <div className='text-sm font-semibold wrap-navbar flex justify-end lg:justify-between'>
        <div className="hidden lg:flex space-x-3 items-center">
          {navItems.map((item, index) => (
            <div key={index} className='flex item-center space-x-1 items-center px-2 py-1.5 btn-navbar cursor-pointer'>
              {item.icon}
              <div>{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <div>
            <div onClick={handleDropdownToggle} className={`${openDropdown ? 'text-blue-400' : ''} flex items-center space-x-2 cursor-pointer`}>
              <div className='items-center text-end'>
                <p className='text-lg hidden md:inline-block'>Tarak Company</p>
                <p className='text-sm'>{name}</p>
              </div>
              <GoTriangleUp className={`${openDropdown ? '' : 'rotate-180'}`} />
            </div>
            <div className="dropdown-container">
              {openDropdown &&
                <ul className="dropdown-list text-md">
                  <Link to={'/profile'} onClick={handleDropdownToggle} className={`${isActive ? 'active-link' : ''} dropdown-list-item flex items-center space-x-2`}>
                    <FaRegUserCircle />
                    <div>Profile</div>
                  </Link>
                  <li onClick={() => { handleOpenModal(); setOpenDropdown(false); }} className="dropdown-list-item flex items-center space-x-2">
                    <IoMdLogOut />
                    <div>Logout</div>
                  </li>
                </ul>
              }
            </div>
          </div>

          <div className="hidden md:flex space-x-3 items-center">
            {actionIcons}
          </div>
        </div>
      </div>
    </>
  );
}
