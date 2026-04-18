import { Outlet } from 'react-router-dom';
import { BrainCircuit, Calculator, Mail, Trophy } from 'lucide-react';
import { Header } from './Header';
import { TabNav } from './TabNav';

const tabs = [
  { to: '/', label: 'AI-analys', icon: BrainCircuit },
  { to: '/mail', label: 'Mail-assistent', icon: Mail, badge: 'NY' },
  { to: '/kalkylator', label: 'Avgifts-kalkylator', icon: Calculator, badge: 'NY' },
  { to: '/kretskampen', label: 'Kretskampen', icon: Trophy },
];

export function Shell() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="app-backdrop" />
      <Header />
      <TabNav tabs={tabs} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
