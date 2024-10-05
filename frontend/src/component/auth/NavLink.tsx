import { Link, useLocation } from "react-router-dom";

interface NavLinkProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, label }) => {
  const isActive = useLocation().pathname === to;

  return (
    <div className={`${isActive ? 'active-link' : ''} nav-button`}>
      <Link to={to} className='fas flex justify-center' aria-label={`Go to ${label}`}>
        <Icon className='size-icon' />
      </Link>
      <Link to={to} className='label-nav'>{label}</Link>
    </div>
  );
};
