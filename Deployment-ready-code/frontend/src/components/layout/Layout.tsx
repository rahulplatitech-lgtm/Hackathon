import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Banner from './Banner';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col antialiased selection:bg-red-500/20 selection:text-red-700">
      <Banner />
      {!isLanding && <Navbar />}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
