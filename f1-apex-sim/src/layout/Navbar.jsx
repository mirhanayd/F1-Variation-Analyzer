import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Rounds' },
  { to: '/circuits', label: 'Circuits' },
  { to: '/simulation', label: 'Simulation' },
];

const Navbar = () => (
  <header className="apiex-navbar">
    <NavLink to="/" className="apiex-brand" aria-label="APiEX home">
      <span className="brand-mark">A</span>
      <span>
        <strong>APiEX</strong>
        <small>F1 variation analyzer</small>
      </span>
    </NavLink>

    <nav className="apiex-nav-links" aria-label="Primary navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `apiex-nav-link ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  </header>
);

export default Navbar;
