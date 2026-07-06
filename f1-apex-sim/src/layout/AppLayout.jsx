import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const AppLayout = () => (
  <div className="apiex-app">
    <Navbar />
    <Outlet />
  </div>
);

export default AppLayout;
