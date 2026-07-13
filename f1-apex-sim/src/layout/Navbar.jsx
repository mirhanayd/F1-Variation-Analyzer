import { NavLink } from 'react-router-dom';

const CalendarIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="8.4" cy="13.6" r="1.3" fill="currentColor" />
    <circle cx="12" cy="13.6" r="1.3" fill="currentColor" />
    <circle cx="15.6" cy="13.6" r="1.3" fill="currentColor" />
  </svg>
);

const CircuitIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 19c-2.6 0-3.9-1.9-3-4 .8-1.9 3-2 4.4-3.4C10 10 8.6 7.2 10.6 5.6 12.8 3.8 16 4.8 17.5 7c1.7 2.4 2.6 5.9.9 8.6C16.6 18.5 13 19 7 19Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M9.5 15.2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1.5 2.4" />
  </svg>
);

const SimulationIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 15.5 8.8 8.2a2 2 0 0 1 1.7-.9h3a2 2 0 0 1 1.7.9l4.8 7.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="6.5" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.5" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const LiveIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8m6.8 0a4.8 4.8 0 0 0 0-6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M5.4 5.4a9.3 9.3 0 0 0 0 13.2m13.2 0a9.3 9.3 0 0 0 0-13.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const navItems = [
  { to: '/', label: 'Schedule', icon: CalendarIcon },
  { to: '/circuits', label: 'Circuits', icon: CircuitIcon },
  { to: '/live', label: 'Live', icon: LiveIcon },
  { to: '/simulation', label: 'Simulation', icon: SimulationIcon },
];

const BrandMark = () => (
  <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" className="brand-mark-bg" />
    <path d="M14 44 30 20h8L22 44z" className="brand-mark-light" />
    <path d="M30 44 46 20h8L38 44z" className="brand-mark-red" />
  </svg>
);

const Navbar = () => (
  <>
    <header className="pw-navbar">
      <NavLink to="/" className="pw-brand" aria-label="PITWALL home">
        <BrandMark />
        <span className="pw-brand-text">
          <strong>PITWALL</strong>
          <small>F1 Race Companion</small>
        </span>
      </NavLink>

      <nav className="pw-nav-links" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `pw-nav-link ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>

    <nav className="pw-tabbar" aria-label="Primary navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `pw-tab ${isActive ? 'active' : ''}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  </>
);

export default Navbar;
