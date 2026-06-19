import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileStack, FolderLock, MessageSquare, PieChart, Users, LogOut, CheckSquare, ShieldCheck, Megaphone, TrendingUp, Network, PiggyBank, ChevronLeft, ChevronRight, ListTodo, UserCheck, ShoppingBag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export function Sidebar({ currentView, onChangeView }: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!currentUser) return null;

  const getMenu = () => {
    const base = [
      { id: 'dashboard', label: 'Dashboard', icon: PieChart },
      { id: 'chat', label: 'Comunicação', icon: MessageSquare },
      { id: 'tasks', label: 'Minhas Tarefas', icon: ListTodo },
      { id: 'docs', label: 'Documentos', icon: FolderLock },
      { id: 'approvals', label: 'Aprovações', icon: CheckSquare },
      { id: 'budgets', label: 'Orçamentos & Verbas', icon: PiggyBank },
      { id: 'orgchart', label: 'Organograma', icon: Network },
    ];

    const isPowerUser = currentUser.isSystemAdmin || 
                        currentUser.department === 'ADMINISTRATIVO' || 
                        currentUser.department === 'TI' || 
                        currentUser.position === 'CEO' || 
                        currentUser.department === 'DIRETORIA';

    // RENDER COMMERCIAL & SALES SEPARATELY
    if (isPowerUser || currentUser.department === 'COMERCIAL') {
      base.push({ id: 'commercial', label: 'Comercial', icon: TrendingUp });
      base.push({ id: 'sales', label: 'Vendas', icon: ShoppingBag });
    }

    // RENDER MARKETING
    if (isPowerUser || currentUser.department === 'MARKETING') {
      base.push({ id: 'marketing', label: 'Marketing', icon: Megaphone });
    }

    // RENDER ADMIN
    if (isPowerUser) {
      base.push({ id: 'admin', label: 'Administrativo', icon: ShieldCheck });
    }

    // RENDER GESTÃO DE RH
    if (isPowerUser || currentUser.department === 'RH') {
      base.push({ id: 'hr', label: 'Gestão de RH', icon: UserCheck });
    }

    return base;
  };

  return (
    <div className={cn(
      "bg-[#0a0a0a] text-gray-300 flex flex-col h-screen border-r border-[#1f1f1f] transition-all duration-300 ease-in-out select-none",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between min-h-[73px]">
        <div className="flex items-center gap-3 text-white overflow-hidden">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Users size={18} className="text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-lg tracking-tight truncate whitespace-nowrap">Nexus ERP</span>
          )}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded transition-colors"
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {!isCollapsed && (
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest pl-3 mb-3">Menu Principal</div>
        )}
        {getMenu().map(item => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
              isCollapsed ? "justify-center" : "justify-start",
              currentView === item.id 
                ? "bg-[#1f1f1f] text-white" 
                : "hover:bg-[#151515] hover:text-white"
            )}
          >
            {currentView === item.id && (
              <motion.div layoutId="sidebar-active" className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full" />
            )}
            <item.icon size={18} className={cn("shrink-0", currentView === item.id ? "text-blue-500" : "text-gray-400")} />
            {!isCollapsed && (
              <span className="truncate">{item.label}</span>
            )}
          </button>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-[#1f1f1f] bg-[#050505] flex flex-col gap-3">
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "justify-start")}>
          <img src={currentUser.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-[#1f1f1f] shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-gray-500 truncate">{currentUser.role || currentUser.position}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={isCollapsed ? "Encerrar Sessão" : undefined}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1f1f1f] transition-colors",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut size={14} className="shrink-0" />
          {!isCollapsed && <span>Encerrar Sessão</span>}
        </button>
      </div>
    </div>
  );
}
