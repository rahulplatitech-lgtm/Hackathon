import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import NearbyHelp from './pages/NearbyHelp';
import Report from './pages/Report';
import Command from './pages/Command';
import PasserbyAlerts from './pages/PasserbyAlerts';
import Simulation from './pages/Simulation';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 3000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/nearby" element={<NearbyHelp />} />
            <Route path="/report" element={<Report />} />
            <Route path="/command" element={<Command />} />
            <Route path="/passerby" element={<PasserbyAlerts />} />
            <Route path="/simulation" element={<Simulation />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
