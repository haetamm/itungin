import { IoHome } from 'react-icons/io5';
import { BiSolidReport } from 'react-icons/bi';
import { BsBank2 } from 'react-icons/bs';
import { IoPricetagsSharp } from 'react-icons/io5';
import { FaShoppingCart } from 'react-icons/fa';
import { RiCurrencyFill } from 'react-icons/ri';
import { RiContactsBook2Fill } from 'react-icons/ri';
import { GiCardboardBoxClosed } from 'react-icons/gi';
import { MdHomeWork } from 'react-icons/md';
import { NavLink } from '../auth/NavLink';
import { RootState } from '../../store';
import { useSelector } from 'react-redux';
import { timestamp } from '../../utils/helper';

import '../../styles/components/sidebar.scss';

export default function SideBar() {
  const { imageUrl, name } = useSelector((state: RootState) => state.user);

  const navLinks = [
    { to: '/home', icon: IoHome, label: 'Home' },
    { to: '/report', icon: BiSolidReport, label: 'Report' },
    { to: '/cash', icon: BsBank2, label: 'Cash & Bank' },
    { to: '/sales', icon: IoPricetagsSharp, label: 'Sales' },
    { to: '/purchases', icon: FaShoppingCart, label: 'Purchase' },
    { to: '/products', icon: GiCardboardBoxClosed, label: 'Products' },
    { to: '/expense', icon: RiCurrencyFill, label: 'Expense' },
    { to: '#', icon: RiContactsBook2Fill, label: 'Contacts' },
    { to: '#', icon: MdHomeWork, label: 'Asset Management' },
  ];

  return (
    <>
      <div id="side-bar">
        <div id="nav-header">
          <a id="nav-title" href="#" className="hidden xl:block">
            Itungin
          </a>
          <hr className="hidden lg:block" />
        </div>
        <div id="nav-content">
          {navLinks.map((link, index) => (
            <NavLink
              key={index}
              to={link.to}
              icon={link.icon}
              label={link.label}
            />
          ))}

          <div id="nav-content-highlight"></div>
        </div>
        <input id="nav-footer-toggle" type="checkbox" />
        <div id="nav-footer">
          <div id="nav-footer-heading">
            <div id="nav-footer-avatar">
              <img
                alt="Avatar"
                src={
                  imageUrl
                    ? `http://localhost:8000/api/v1/user${imageUrl}?update=${timestamp}`
                    : 'http://laravel-react-fullstack.test/default-image.png'
                }
              />
            </div>
            <div id="nav-footer-titlebox">
              <a id="nav-footer-title" href="#" target="_blank">
                {name}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
