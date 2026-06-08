import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { AIPage } from '@/pages/AIPage';
import { KretskampenPage } from '@/pages/KretskampenPage';
import { MailAssistantPage } from '@/pages/MailAssistantPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { GranskningPage } from '@/pages/GranskningPage';
import { StatusPage } from '@/pages/StatusPage';
import { LoggbokPage } from '@/pages/LoggbokPage';
import { RoadmapPage } from '@/pages/RoadmapPage';
import { KunskapsbasForslagPage } from '@/pages/KunskapsbasForslagPage';
import { Shell } from '@/components/layout/Shell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ChatProvider } from '@/contexts/ChatContext';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <ChatProvider>
              <Shell />
            </ChatProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<InsightsPage />} />
        <Route path="/ai-analys" element={<AIPage />} />
        <Route path="/mail" element={<MailAssistantPage />} />
        <Route path="/kretskampen" element={<KretskampenPage />} />
        <Route path="/kunskapsbas" element={<KnowledgeBasePage />} />
        <Route path="/granskning" element={<GranskningPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/loggbok" element={<LoggbokPage />} />
        <Route path="/kunskapsbas-forslag" element={<KunskapsbasForslagPage />} />
        <Route path="/pa-gang" element={<RoadmapPage />} />
        <Route path="/insikter" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
