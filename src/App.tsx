import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { AIPage } from '@/pages/AIPage';
import { KretskampenPage } from '@/pages/KretskampenPage';
import { MailAssistantPage } from '@/pages/MailAssistantPage';
import { FeeCalculatorPage } from '@/pages/FeeCalculatorPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { Shell } from '@/components/layout/Shell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<AIPage />} />
        <Route path="/mail" element={<MailAssistantPage />} />
        <Route path="/kalkylator" element={<FeeCalculatorPage />} />
        <Route path="/kretskampen" element={<KretskampenPage />} />
        <Route path="/insikter" element={<InsightsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
