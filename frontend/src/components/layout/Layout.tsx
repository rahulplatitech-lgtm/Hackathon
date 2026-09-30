import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Banner from './Banner';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-blue-500/20 selection:text-blue-200">
      <Banner />
      <Navbar />
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
