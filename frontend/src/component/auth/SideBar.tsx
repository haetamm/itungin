import { useEffect, useRef } from 'react'
import { IoHome } from "react-icons/io5";
import { BiSolidReport } from "react-icons/bi";
import { BsBank2 } from "react-icons/bs";
import { IoPricetagsSharp } from "react-icons/io5";
import { GoTriangleUp } from "react-icons/go";
import { FaShoppingCart } from "react-icons/fa";
import { RiCurrencyFill } from "react-icons/ri";
import { RiContactsBook2Fill } from "react-icons/ri";
import { GiCardboardBoxClosed } from "react-icons/gi";
import { MdHomeWork } from "react-icons/md";
import { NavLink } from '../auth/NavLink';

import '../../styles/components/sidebar.scss';
import { RootState } from '../../store';
import { useSelector } from 'react-redux';


export default function SideBar() {
  const navToggleRef = useRef<HTMLInputElement>(null);
  const { name } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    const handleResize = () => {
      const navToggle = navToggleRef.current;
      if (navToggle) {
        navToggle.checked = window.innerWidth > 1024;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [navToggleRef]);

  const navLinks = [
    { to: '/home', icon: IoHome, label: 'Home' },
    { to: '/report', icon: BiSolidReport, label: 'Report' },
    { to: '/cash', icon: BsBank2, label: 'Cash & Bank' },
    { to: '/sales', icon: IoPricetagsSharp, label: 'Sales' },
    { to: '/purchases', icon: FaShoppingCart, label: 'Purchase' },
    { to: '/expense', icon: RiCurrencyFill, label: 'Expense' },
    { to: '#', icon: RiContactsBook2Fill, label: 'Contacts' },
    { to: '#', icon: GiCardboardBoxClosed, label: 'Products' },
    { to: '#', icon: MdHomeWork, label: 'Asset Management' }
  ];

  return (
    <>
      <div id="nav-bar">
        <input id="nav-toggle" type="checkbox" ref={navToggleRef}/>
        <div id="nav-header">
          <a id="nav-title" href="#">
            Itungin
          </a>
          <hr />
        </div>
        <div id="nav-content">

          {navLinks.map((link, index) => (
            <NavLink key={index} to={link.to} icon={link.icon} label={link.label} />
          ))}
          
          <div id="nav-content-highlight"></div>
        </div>
        <input id="nav-footer-toggle" type="checkbox" />
        <div id="nav-footer">
          <div id="nav-footer-heading">
            <div id="nav-footer-avatar">
              <img
                alt="Avatar" 
                src={"http://laravel-react-fullstack.test/default-image.png"} 
              />
            </div>
            <div id="nav-footer-titlebox">
              <a id="nav-footer-title" href="#" target="_blank">{name}</a>
            </div>
            <label htmlFor="nav-footer-toggle">
              <i className="fas"><GoTriangleUp /></i>
            </label>
          </div>
          <div id="nav-footer-content">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </div>
        </div>
      </div>
    </>
  )
}
