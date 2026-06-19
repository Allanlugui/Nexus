/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { LoginView } from './views/LoginView';
import { SetupView } from './views/SetupView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { ChatView } from './views/ChatView';
import { DocumentsView } from './views/DocumentsView';
import { ApprovalsView } from './views/ApprovalsView';
import { BudgetsView } from './views/BudgetsView';
import { OrgChartView } from './views/OrgChartView';
import { AdminView } from './views/AdminView';
import { CommercialView } from './views/CommercialView';
import { MarketingView } from './views/MarketingView';
import { HRView } from './views/HRView';
import { TasksView } from './views/TasksView';
import { SalesView } from './views/SalesView';
import { loginWithGoogle } from './lib/firebase';
import { LogIn } from 'lucide-react';

function AppContent() {
  const { currentUser, isInitialized, needsAuth, setNeedsAuth } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [chatTargetId, setChatTargetId] = useState<string | undefined>();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  if (isInitialized === null) {
     return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Inicializando sistema...</div>;
  }

  if (isInitialized === false && !currentUser) {
    return <SetupView />;
  }

  if (!currentUser) {
    return <LoginView />;
  }

  const navigateToChat = (userId?: string) => {
    setChatTargetId(userId);
    setCurrentView('chat');
  };

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true);
    try {
      await loginWithGoogle();
      setNeedsAuth(false);
    } catch (error) {
      console.error('Google Auth Failed', error);
    }
    setIsAuthenticating(false);
  };

  return (
    <div className="flex h-screen print:h-auto print:block bg-[#fafafa] print:bg-white overflow-hidden print:overflow-visible font-sans relative">
      {needsAuth && (
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
           <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
               <LogIn size={32} />
             </div>
             <h2 className="text-xl font-bold text-gray-900 mb-2">Conexão com Google necessária</h2>
             <p className="text-gray-600 mb-6 text-sm">
               Para acessar seus documentos do Google Drive e agendar postagens no Google Calendar, você precisa conectar sua conta do Google Workspace.
             </p>
             <button 
               onClick={handleGoogleAuth}
               disabled={isAuthenticating}
               className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
             >
                {isAuthenticating ? 'Conectando...' : 'Conectar Google Workspace'}
             </button>
             <button 
               onClick={() => setNeedsAuth(false)}
               className="w-full mt-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium py-3 rounded-xl transition-colors"
             >
                Agora não
             </button>
           </div>
        </div>
      )}
      <div className="print:hidden h-full">
        <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      </div>
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'chat' && <ChatView initialActiveUserId={chatTargetId} />}
        {currentView === 'docs' && <DocumentsView />}
        {currentView === 'approvals' && <ApprovalsView />}
        {currentView === 'budgets' && <BudgetsView />}
        {currentView === 'orgchart' && <OrgChartView />}
        {currentView === 'commercial' && <CommercialView />}
        {currentView === 'sales' && <SalesView />}
        {currentView === 'marketing' && <MarketingView />}
        {currentView === 'admin' && <AdminView />}
        {currentView === 'hr' && <HRView />}
        {currentView === 'tasks' && <TasksView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
