import { Outlet, ScrollRestoration } from 'react-router-dom';
import Navbar from './Navbar';

const AppLayout = () => (
  <div className="pw-app">
    <Navbar />
    <Outlet />
    <footer className="pw-footer">
      <span>PITWALL — unofficial F1 companion. Data: OpenF1 &amp; Jolpica. Not affiliated with Formula 1.</span>
    </footer>
    <ScrollRestoration />
  </div>
);

export default AppLayout;
