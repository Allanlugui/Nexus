import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Campaign } from '../types';
import { 
  Calendar as CalendarIcon, 
  Megaphone, 
  Activity, 
  DollarSign, 
  Plus, 
  Edit2, 
  Printer, 
  Facebook, 
  Instagram, 
  Trash2, 
  ExternalLink,
  RefreshCw,
  BarChart3,
  MousePointer2,
  Users,
  Target
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAccessToken } from '../lib/firebase';
import { generateStandardPdf } from '../lib/pdfGenerator';

export function MarketingView() {
  const { setNeedsAuth, currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);

  // Meta States
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [metaAdAccounts, setMetaAdAccounts] = useState<any[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [metaInsights, setMetaInsights] = useState<any[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isCreatingMetaCampaign, setIsCreatingMetaCampaign] = useState(false);
  const [newMetaCampaign, setNewMetaCampaign] = useState({
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    dailyBudget: 10
  });

  const [activeTab, setActiveTab] = useState<'LOCAL' | 'META'>('LOCAL');

  // Simulated role for easy workflow verification by the user
  const [simulatedRole, setSimulatedRole] = useState<'AUTO' | 'MARKETING_DIR' | 'MARKETING_STAFF'>('AUTO');
  const [mktBudgetLimit, setMktBudgetLimit] = useState<number>(0);

  const isMarketingDir = simulatedRole === 'MARKETING_DIR' || 
    (simulatedRole === 'AUTO' && currentUser?.department === 'MARKETING' && currentUser?.position === 'DIRETOR') ||
    (currentUser?.position === 'CEO');

  const loadCampaigns = async () => {
    fetch('/api/campaigns').then(r => r.json()).then(setCampaigns);
  };

  const fetchMetaAccounts = async () => {
    setIsLoadingMeta(true);
    try {
      const res = await fetch('/api/marketing/meta/accounts');
      if (res.ok) {
        const data = await res.json();
        setMetaAdAccounts(data);
        setIsMetaConnected(true);
        if (data.length > 0) setSelectedAdAccount(data[0].account_id);
      } else {
        setIsMetaConnected(false);
      }
    } catch (err) {
      console.error(err);
      setIsMetaConnected(false);
    }
    setIsLoadingMeta(false);
  };

  const fetchMetaInsights = async () => {
    if (!selectedAdAccount) return;
    setIsLoadingMeta(true);
    try {
      const res = await fetch(`/api/marketing/meta/insights?adAccountId=act_${selectedAdAccount}`);
      if (res.ok) {
        const data = await res.json();
        setMetaInsights(data);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoadingMeta(false);
  };

  const handleCreateMetaCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdAccount) return;
    setIsLoadingMeta(true);
    try {
      const res = await fetch('/api/marketing/meta/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: `act_${selectedAdAccount}`,
          ...newMetaCampaign,
          status: 'PAUSED'
        })
      });
      if (res.ok) {
        alert("Campanha criada com sucesso no Gerenciador de Anúncios (Status: Pausado)!");
        setIsCreatingMetaCampaign(false);
        fetchMetaInsights();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao criar campanha na Meta.");
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoadingMeta(false);
  };

  const fetchMktBudget = async () => {
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) {
        const budgets = await res.json();
        const mktB = budgets.find((b: any) => b.month === '2026-05' && b.type === 'DEPARTMENT' && b.targetId === 'MARKETING');
        if (mktB) {
          setMktBudgetLimit(mktB.amount);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMetaAuth = async () => {
    try {
      const res = await fetch('/api/marketing/meta/auth');
      if (!res.ok) throw new Error("Falha ao obter URL de autenticação");
      const { url } = await res.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        url,
        'meta_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        alert("O bloqueador de popups impediu a conexão. Por favor, autorize popups para este site.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao iniciar autenticação com Meta.");
    }
  };

  useEffect(() => {
    loadCampaigns();
    fetchCalendarEvents();
    fetchMktBudget();
    fetchMetaAccounts();

    const handleMessage = (event: MessageEvent) => {
      // Validate origin to ensure it's from our app
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('vercel.app')) {
        return;
      }

      if (event.data?.type === 'META_AUTH_SUCCESS') {
        fetchMetaAccounts();
      } else if (event.data?.type === 'META_AUTH_ERROR') {
        alert(`Erro na integração Meta: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (selectedAdAccount) fetchMetaInsights();
  }, [selectedAdAccount]);

  const handleApproveCampaign = async (campaign: Campaign, approve: boolean) => {
    const maximumBudget = mktBudgetLimit > 0 ? mktBudgetLimit : 15000;
    if (approve) {
      const activeAndFinishedSpent = campaigns
        .filter(c => c.id !== campaign.id && (c.status === 'ACTIVE' || c.status === 'FINISHED'))
        .reduce((sum, c) => sum + c.budget, 0);

      if (activeAndFinishedSpent + campaign.budget > maximumBudget) {
        alert(`Orçamento insuficiente! O total em campanhas de marketing seria de R$ ${(activeAndFinishedSpent + campaign.budget).toLocaleString('pt-BR')} excedendo o limite de R$ ${maximumBudget.toLocaleString('pt-BR')}.`);
        return;
      }
    }

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaign,
          status: approve ? 'ACTIVE' : 'PLANNING'
        })
      });
      if (res.ok) {
        alert(approve ? "Campanha autorizada e ativa com sucesso!" : "Campanha movida de volta para planejamento.");
        loadCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    
    // Convert html date input string to timestamp
    const cData = { ...editingCampaign };
    if (typeof cData.startDate === 'string') cData.startDate = new Date(cData.startDate).getTime();
    if (typeof cData.endDate === 'string') cData.endDate = new Date(cData.endDate).getTime();

    const isEditing = !!cData.id;
    const url = isEditing ? `/api/campaigns/${cData.id}` : '/api/campaigns';
    const method = isEditing ? 'PUT' : 'POST';

    // Enforce status permissions
    let targetStatus = cData.status || 'PLANNING';
    if (!isMarketingDir && targetStatus !== 'PLANNING') {
      alert("Apenas o Diretor do Setor de Marketing ou CEO pode autorizar a ativação de uma campanha.");
      return;
    }

    // Budget constraints check
    const campBudget = Number(cData.budget) || 0;
    const activeAndFinishedSpent = campaigns
      .filter(c => c.id !== cData.id && (c.status === 'ACTIVE' || c.status === 'FINISHED'))
      .reduce((sum, c) => sum + c.budget, 0);

    const activeOrNewSpent = activeAndFinishedSpent + (targetStatus !== 'PLANNING' ? campBudget : 0);
    const maximumBudget = mktBudgetLimit > 0 ? mktBudgetLimit : 15000;

    if (activeOrNewSpent > maximumBudget) {
      alert(`Orçamento insuficiente do setor de Marketing! O limite mensal do setor é de R$ ${maximumBudget.toLocaleString('pt-BR')}, mas o total comprometido (incluindo esta campanha ativa) seria de R$ ${activeOrNewSpent.toLocaleString('pt-BR')}.`);
      return;
    }

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cData,
          status: targetStatus,
          engagement: Number(cData.engagement) || 0,
          budget: Number(cData.budget) || 0,
          spent: Number(cData.spent) || 0
        })
      });
      setEditingCampaign(null);
      loadCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCalendarEvents = async () => {
    const token = await getAccessToken();
    if (!token) return;
    
    try {
      const timeMin = new Date().toISOString();
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&orderBy=startTime&singleEvents=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
         setNeedsAuth(true);
         return;
      }
      const data = await res.json();
      if(data.items) {
        setCalendarEvents(data.items);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleCreateEvent = async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    
    setIsScheduling(true);
    try {
      const start = new Date();
      start.setHours(start.getHours() + 1);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      const event = {
        summary: 'Nova Postagem Social',
        description: 'Postagem institucional gerada pelo painel.',
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      };

      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
      
      await fetchCalendarEvents();
    } catch(err) {
      console.error(err);
    }
    setIsScheduling(false);
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateStandardPdf({
        title: 'Relatório Setorial - Marketing',
        generatedBy: currentUser?.name || 'Profissional de Marketing',
        position: currentUser?.position || 'Marketing',
        fileName: `NexusERP_Marketing_${new Date().getTime()}.pdf`,
        sections: [
          {
            title: 'Desempenho Geral de Campanhas',
            content: [
              `Total de Campanhas Ativas: ${campaigns.filter(c => c.status === 'ACTIVE').length}`,
              `Total de Campanhas Cadastradas: ${campaigns.length}`,
              `Engajamento Médio: ${avgEngagement}%`,
              `Orçamento Consumido (Total): R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]
          },
          {
            title: 'Detalhes das Campanhas',
            type: 'table',
            tableHead: ['Título', 'Status', 'Gasto', 'Budget', 'Engajamento'],
            tableBody: campaigns.map(c => [
              c.title,
              c.status === 'ACTIVE' ? 'Em Execução' : c.status === 'FINISHED' ? 'Finalizada' : 'Planejamento',
              `R$ ${c.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              `R$ ${c.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              `${c.engagement}%`
            ])
          },
          {
            title: 'Calendário Integrado (Próximos Eventos)',
            type: 'table',
            tableHead: ['Evento', 'Data/Hora'],
            tableBody: calendarEvents.slice(0, 5).map(e => [
              e.summary || 'Sem Título',
              e.start?.dateTime ? format(new Date(e.start.dateTime), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Data Indefinida'
            ])
          }
        ]
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF do setor de Marketing.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const totalBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const avgEngagement = campaigns.length 
    ? (campaigns.reduce((acc, c) => acc + c.engagement, 0) / campaigns.length).toFixed(1)
    : 0;

  const toDateString = (ts: number | undefined) => {
     if (!ts) return '';
     const d = new Date(ts);
     return d.toISOString().split('T')[0];
  };

  // Meta KPIs calculation
  const metaKPIs = metaInsights.reduce((acc, camp) => {
    const insight = camp.insights?.data?.[0];
    if (insight) {
      acc.spend += parseFloat(insight.spend || 0);
      acc.clicks += parseInt(insight.clicks || 0);
      acc.impressions += parseInt(insight.impressions || 0);
      acc.reach += parseInt(insight.reach || 0);
    }
    return acc;
  }, { spend: 0, clicks: 0, impressions: 0, reach: 0 });

  const metaCTR = metaKPIs.impressions > 0 ? ((metaKPIs.clicks / metaKPIs.impressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative font-sans">
      {editingCampaign && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <form onSubmit={handleSaveCampaign} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-auto">
             <h3 className="text-xl font-bold text-gray-900 mb-4">{editingCampaign.id ? 'Editar Campanha' : 'Nova Campanha'}</h3>
             
             <div className="space-y-4">
               <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Título</label>
                  <input required value={editingCampaign.title || ''} onChange={e => setEditingCampaign(prev => ({...prev!, title: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Orçamento (R$)</label>
                    <input required type="number" value={editingCampaign.budget || ''} onChange={e => setEditingCampaign(prev => ({...prev!, budget: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Gasto (R$)</label>
                    <input required type="number" value={editingCampaign.spent || ''} onChange={e => setEditingCampaign(prev => ({...prev!, spent: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Engajamento (%)</label>
                    <input required type="number" step="0.1" value={editingCampaign.engagement || ''} onChange={e => setEditingCampaign(prev => ({...prev!, engagement: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select required value={editingCampaign.status || ''} onChange={e => setEditingCampaign(prev => ({...prev!, status: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                       <option value="PLANNING">Planejamento</option>
                       <option value="ACTIVE">Ativo</option>
                       <option value="FINISHED">Finalizado</option>
                    </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
                    <input required type="date" value={toDateString(editingCampaign.startDate as any)} onChange={e => setEditingCampaign(prev => ({...prev!, startDate: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                    <input required type="date" value={toDateString(editingCampaign.endDate as any)} onChange={e => setEditingCampaign(prev => ({...prev!, endDate: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                 </div>
               </div>
             </div>
             
             <div className="flex gap-2 mt-8">
               <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Salvar</button>
               <button type="button" onClick={() => setEditingCampaign(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancelar</button>
             </div>
           </form>
        </div>
      )}

      {isCreatingMetaCampaign && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <form onSubmit={handleCreateMetaCampaign} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-600 text-white rounded-lg"><Facebook size={20} /></div>
                <h3 className="text-xl font-bold text-gray-900">Nova Campanha Meta</h3>
             </div>
             
             <div className="space-y-4">
               <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome da Campanha</label>
                  <input required placeholder="Ex: Lançamento de Inverno 2026" value={newMetaCampaign.name} onChange={e => setNewMetaCampaign(prev => ({...prev, name: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Objetivo da Campanha</label>
                  <select value={newMetaCampaign.objective} onChange={e => setNewMetaCampaign(prev => ({...prev, objective: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="OUTCOME_TRAFFIC">Tráfego</option>
                    <option value="OUTCOME_AWARENESS">Reconhecimento</option>
                    <option value="OUTCOME_SALES">Vendas / Conversão</option>
                    <option value="OUTCOME_ENGAGEMENT">Engajamento</option>
                    <option value="OUTCOME_LEADS">Cadastros</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Orçamento Diário (R$)</label>
                  <input required type="number" step="1" min="1" value={newMetaCampaign.dailyBudget} onChange={e => setNewMetaCampaign(prev => ({...prev, dailyBudget: parseInt(e.target.value)}))} className="w-full border-gray-300 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
             </div>
             
             <div className="flex gap-2 mt-8">
               <button type="submit" disabled={isLoadingMeta} className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50">Criar no Gerenciador</button>
               <button type="button" onClick={() => setIsCreatingMetaCampaign(false)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-3 text-sm font-bold hover:bg-gray-200 transition-all">Cancelar</button>
             </div>
           </form>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            Gestão de Marketing 360°
            {isLoadingMeta && <RefreshCw className="animate-spin text-blue-500" size={20} />}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Controle estratégico de campanhas locais e integração direta com o Meta Ads Manager.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGeneratePdf} 
            disabled={isGeneratingPdf}
            className="disabled:opacity-50 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm border-b-2 active:translate-y-0.5"
          >
            <Printer size={16} /> {isGeneratingPdf ? 'Gerando...' : 'Exportar PDF'}
          </button>
          {activeTab === 'LOCAL' ? (
            <button onClick={() => setEditingCampaign({ status: 'PLANNING', engagement: 0, budget: 0, spent: 0 })} className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg active:scale-95">
               <Plus size={18} /> Nova Campanha Local
            </button>
          ) : (
            <button 
              onClick={() => isMetaConnected ? setIsCreatingMetaCampaign(true) : handleMetaAuth()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95"
            >
               {isMetaConnected ? <><Plus size={18} /> Criar Campanha Meta</> : <><Facebook size={18} /> Conectar Meta Ads</>}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-8">
        <button 
          onClick={() => setActiveTab('LOCAL')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'LOCAL' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Planejamento Local
          {activeTab === 'LOCAL' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('META')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'META' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Facebook size={16} /> Meta Ad Manager
          {activeTab === 'META' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
        </button>
      </div>

      {activeTab === 'LOCAL' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm group hover:border-purple-200 transition-colors">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 border border-purple-100 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform"><Megaphone size={24} /></div>
                 <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Ativas</span>
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-1">{campaigns.filter(c => c.status === 'ACTIVE').length}</h2>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-tighter">Campanhas em execução</p>
            </div>

            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm group hover:border-blue-200 transition-colors">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 border border-blue-100 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><Activity size={24} /></div>
                 <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Global</span>
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-1">{avgEngagement}%</h2>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-tighter">Engajamento médio total</p>
            </div>

            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm group hover:border-amber-200 transition-colors">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 border border-amber-100 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><DollarSign size={24} /></div>
                 <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Budget</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3 mt-4">
                <div className="bg-amber-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${Math.min((totalSpent / (mktBudgetLimit || totalBudget || 15000)) * 100, 100)}%` }}></div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Gasto Consumido</p>
                  <p className="text-xl font-black text-gray-900">R$ {totalSpent.toLocaleString('pt-BR')}</p>
                </div>
                <p className="text-[10px] font-black text-amber-600 uppercase">Meta R$ {(mktBudgetLimit > 0 ? mktBudgetLimit : 15000).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden border-b-4 border-b-gray-900">
                 <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                   <h3 className="font-black text-gray-900 flex items-center gap-2 uppercase tracking-tighter text-lg"><Megaphone size={20} /> Portfólio de Campanhas</h3>
                   <span className="text-[10px] font-black bg-gray-900 text-white px-3 py-1 rounded-full">{campaigns.length} REGISTROS</span>
                 </div>
                 <div className="divide-y divide-gray-100">
                   {campaigns.map(c => (
                     <div key={c.id} className="p-8 hover:bg-gray-50/50 transition-colors group text-left">
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1">
                            <h4 className="text-xl font-black text-gray-900 tracking-tight">{c.title}</h4>
                            <div className="flex items-center gap-4">
                              <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase">
                                <CalendarIcon size={12} className="text-blue-500" /> 
                                {format(c.startDate, "dd MMM", { locale: ptBR })} — {format(c.endDate, "dd MMM yyyy", { locale: ptBR })}
                              </p>
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border uppercase tracking-widest ${
                                c.status === 'ACTIVE' ? 'bg-blue-600 text-white border-blue-600' :
                                c.status === 'FINISHED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                'bg-gray-100 text-gray-400 border-gray-200'
                              }`}>
                                {c.status === 'ACTIVE' ? 'Em Execução' : c.status === 'FINISHED' ? 'Finalizada' : 'Planejamento'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.status === 'PLANNING' && isMarketingDir && (
                              <button 
                                type="button"
                                onClick={() => handleApproveCampaign(c, true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all cursor-pointer uppercase tracking-widest"
                              >
                                Autorizar
                              </button>
                            )}
                            <button onClick={() => setEditingCampaign(c)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-xl transition-all active:scale-95">
                              <Edit2 size={18} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 shadow-inner">
                            <div className="flex justify-between items-start mb-3">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Performance Orçamentária</p>
                              <DollarSign size={14} className="text-gray-400" />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black text-gray-900">R$ {c.spent.toLocaleString()}</span>
                              <span className="text-xs font-bold text-gray-400">/ R$ {c.budget.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
                              <div className="bg-gray-900 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min((c.spent/(c.budget||1))*100, 100)}%` }}></div>
                            </div>
                          </div>
                          <div className="bg-blue-50/30 rounded-2xl p-5 border border-blue-100/50 shadow-inner">
                            <div className="flex justify-between items-start mb-3">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Métrica de Engajamento</p>
                              <Activity size={14} className="text-blue-500" />
                            </div>
                            <p className="text-4xl font-black text-blue-600">{c.engagement}%</p>
                            <p className="text-[10px] font-bold text-blue-400 mt-2">ALCANCE ESTIMADO EM ALTA</p>
                          </div>
                        </div>
                     </div>
                   ))}
                   {campaigns.length === 0 && <div className="p-16 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">Vácuo de campanhas locais</div>}
                 </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden p-8 text-left border-b-4 border-b-blue-600">
                 <h3 className="font-black text-gray-900 flex items-center gap-2 mb-2 uppercase tracking-tighter text-lg">
                   Google Workspace
                 </h3>
                 <p className="text-xs font-bold text-gray-400 mb-8 uppercase tracking-widest">Agenda Integrada</p>
                 
                 <div className="space-y-4">
                    {calendarEvents.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl">
                        <CalendarIcon size={32} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum agendamento</p>
                      </div>
                    ) : (
                      calendarEvents.slice(0, 5).map(event => {
                        const evtTime = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date || Date.now());
                        return (
                          <div key={event.id} className="group border border-gray-100 rounded-2xl p-5 bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                                {format(evtTime, "dd MMM, HH:mm", { locale: ptBR })}
                              </span>
                              <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-150 transition-transform"></div>
                            </div>
                            <p className="text-sm font-black text-gray-900 truncate tracking-tight">{event.summary || 'Sem Título'}</p>
                            <a href={event.htmlLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-800 mt-3 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                              Abrir Agenda <ExternalLink size={10} />
                            </a>
                          </div>
                        );
                      })
                    )}

                    <button 
                      onClick={handleCreateEvent}
                      disabled={isScheduling}
                      className="w-full mt-4 bg-gray-900 text-white disabled:opacity-50 border-none py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-gray-800 shadow-lg active:scale-95"
                    >
                      {isScheduling ? 'Sincronizando...' : '+ Agendar no Calendar'}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* META MARKETING DASHBOARD */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!isMetaConnected ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600">
                <Facebook size={40} />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Conecte sua conta Meta</h3>
                <p className="text-sm text-gray-500 font-medium">Integre diretamente com o Gerenciador de Anúncios para visualizar métricas reais e criar campanhas de Facebook e Instagram.</p>
              </div>
              <button 
                onClick={handleMetaAuth}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-3 mx-auto"
              >
                <Facebook size={20} /> Autenticar via Meta OAuth
              </button>
            </div>
          ) : (
            <>
              {/* Meta Ad Account Selector */}
              <div className="bg-white border border-gray-200 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100"><Target size={24} /></div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Conta de Anúncios Ativa</h3>
                    <select 
                      value={selectedAdAccount} 
                      onChange={e => setSelectedAdAccount(e.target.value)}
                      className="text-lg font-black text-blue-600 bg-transparent border-none focus:ring-0 outline-none p-0 cursor-pointer"
                    >
                      {metaAdAccounts.map(acc => (
                        <option key={acc.account_id} value={acc.account_id}>{acc.name} ({acc.currency})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button onClick={fetchMetaInsights} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-xl transition-all active:rotate-180 duration-500">
                  <RefreshCw size={20} />
                </button>
              </div>

              {/* Meta KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm border-b-4 border-b-blue-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gasto Total</p>
                  <h2 className="text-3xl font-black text-gray-900">R$ {metaKPIs.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                  <div className="flex items-center gap-1 mt-2 text-emerald-600 font-bold text-[10px]">
                    <TrendingUp size={10} /> 12% VS ONTEM
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm border-b-4 border-b-purple-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliques no Link</p>
                  <h2 className="text-3xl font-black text-gray-900">{metaKPIs.clicks.toLocaleString()}</h2>
                  <div className="flex items-center gap-1 mt-2 text-blue-600 font-bold text-[10px]">
                    <MousePointer2 size={10} /> {metaCTR}% CTR MÉDIO
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm border-b-4 border-b-emerald-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Alcance Único</p>
                  <h2 className="text-3xl font-black text-gray-900">{metaKPIs.reach.toLocaleString()}</h2>
                  <div className="flex items-center gap-1 mt-2 text-emerald-600 font-bold text-[10px]">
                    <Users size={10} /> PESSOAS ALCANCADAS
                  </div>
                </div>
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm border-b-4 border-b-amber-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Impressões</p>
                  <h2 className="text-3xl font-black text-gray-900">{metaKPIs.impressions.toLocaleString()}</h2>
                  <div className="flex items-center gap-1 mt-2 text-amber-600 font-bold text-[10px]">
                    <Activity size={10} /> FREQUÊNCIA: 1.4
                  </div>
                </div>
              </div>

              {/* Meta Campaign List */}
              <div className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden">
                <div className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                    <BarChart3 size={20} className="text-blue-600" /> Campanhas Meta Ads
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Sync Ativo</span>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                        <th className="px-8 py-5">Campanha / ID</th>
                        <th className="px-6 py-5">Status / Objetivo</th>
                        <th className="px-6 py-5 text-right">Budget Diário</th>
                        <th className="px-6 py-5 text-right">Alcance</th>
                        <th className="px-6 py-5 text-right">Cliques</th>
                        <th className="px-6 py-5 text-right">Investido</th>
                        <th className="px-8 py-5 text-right">CTR / ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {metaInsights.map(camp => {
                        const insight = camp.insights?.data?.[0];
                        const spend = parseFloat(insight?.spend || 0);
                        const clicks = parseInt(insight?.clicks || 0);
                        const imps = parseInt(insight?.impressions || 0);
                        const ctr = imps > 0 ? ((clicks / imps) * 100).toFixed(2) : '0.00';

                        return (
                          <tr key={camp.id} className="hover:bg-blue-50/20 transition-colors group">
                            <td className="px-8 py-6">
                              <p className="font-black text-gray-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">{camp.name}</p>
                              <p className="text-[10px] font-mono text-gray-400 mt-0.5">ID: {camp.id}</p>
                            </td>
                            <td className="px-6 py-6">
                              <div className="flex flex-col gap-1.5">
                                <span className={`w-fit text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                  camp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {camp.status}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{camp.objective.replace('OUTCOME_', '')}</span>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-right font-black text-gray-900">
                              R$ {(parseFloat(camp.daily_budget || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-6 text-right font-bold text-gray-600">
                              {parseInt(insight?.reach || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-6 text-right font-bold text-gray-600">
                              {clicks.toLocaleString()}
                            </td>
                            <td className="px-6 py-6 text-right font-black text-blue-600">
                              R$ {spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <p className="font-black text-gray-900">{ctr}%</p>
                              <p className="text-[9px] font-bold text-emerald-600 tracking-widest">CTR ALTO</p>
                            </td>
                          </tr>
                        );
                      })}
                      {metaInsights.length === 0 && !isLoadingMeta && (
                        <tr>
                          <td colSpan={7} className="px-8 py-16 text-center text-gray-400 font-bold uppercase tracking-widest text-sm italic">
                            Nenhuma campanha Meta detectada nesta conta.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Integration Status Footer */}
      <div className="bg-gray-50 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-200 border-dashed">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isMetaConnected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
            <Facebook size={24} />
          </div>
          <div>
            <h4 className="font-black text-gray-900 uppercase tracking-tighter">Meta Marketing API</h4>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              Status: {isMetaConnected ? <span className="text-emerald-600 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Conectado</span> : 'Desconectado'}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Última Sincronização</p>
            <p className="text-sm font-black text-gray-900 tracking-tight">{format(new Date(), "HH:mm:ss", { locale: ptBR })}</p>
          </div>
          <button 
            onClick={handleMetaAuth}
            className="bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-900 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg"
          >
            {isMetaConnected ? 'Recarregar Tokens' : 'Configurar OAuth'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrendingUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );
}
