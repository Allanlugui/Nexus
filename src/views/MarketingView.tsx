import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Campaign } from '../types';
import { Calendar as CalendarIcon, Megaphone, Activity, DollarSign, Plus, Edit2, Printer } from 'lucide-react';
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

  // Simulated role for easy workflow verification by the user
  const [simulatedRole, setSimulatedRole] = useState<'AUTO' | 'MARKETING_DIR' | 'MARKETING_STAFF'>('AUTO');
  const [mktBudgetLimit, setMktBudgetLimit] = useState<number>(0);

  const isMarketingDir = simulatedRole === 'MARKETING_DIR' || 
    (simulatedRole === 'AUTO' && currentUser?.department === 'MARKETING' && currentUser?.position === 'DIRETOR') ||
    (currentUser?.position === 'CEO');

  const loadCampaigns = async () => {
    fetch('/api/campaigns').then(r => r.json()).then(setCampaigns);
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

  useEffect(() => {
    loadCampaigns();
    fetchCalendarEvents();
    fetchMktBudget();
  }, []);

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

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Gestão de Marketing</h1>
          <p className="text-sm text-gray-500 mt-1">Controle de campanhas, engajamento e calendário de publicidade (Google Calendar).</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGeneratePdf} 
            disabled={isGeneratingPdf}
            className="disabled:opacity-50 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Printer size={16} /> {isGeneratingPdf ? 'Gerando...' : 'Gerar Relatório'}
          </button>
          <button onClick={() => setEditingCampaign({ status: 'PLANNING', engagement: 0, budget: 0, spent: 0 })} className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
             <Plus size={16} /> Nova Campanha
          </button>
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 border border-purple-100 bg-purple-50 text-purple-600 rounded-lg"><Megaphone size={20} /></div>
             <h3 className="font-medium text-gray-700">Campanhas Ativas</h3>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{campaigns.filter(c => c.status === 'ACTIVE').length}</h2>
          <p className="text-xs text-gray-500">De {campaigns.length} cadastradas</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 border border-blue-100 bg-blue-50 text-blue-600 rounded-lg"><Activity size={20} /></div>
             <h3 className="font-medium text-gray-700">Engajamento Médio</h3>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{avgEngagement}%</h2>
          <p className="text-xs text-gray-500">Interações vs Impressões</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 border border-amber-100 bg-amber-50 text-amber-600 rounded-lg"><DollarSign size={20} /></div>
             <h3 className="font-medium text-gray-700">Orçamento Consumido</h3>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
            <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${Math.min((totalSpent / (mktBudgetLimit || totalBudget || 15000)) * 100, 100)}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 flex justify-between">
            <span>Gasto: R$ {totalSpent.toLocaleString('pt-BR')}</span>
            <span>Total: R$ {(mktBudgetLimit > 0 ? mktBudgetLimit : 15000).toLocaleString('pt-BR')}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
           <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
             <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Megaphone size={18} /> Publicidade em Andamento</h3>
           </div>
           <div className="divide-y divide-gray-100">
             {campaigns.map(c => (
               <div key={c.id} className="p-6 hover:bg-gray-50/50 transition-colors group text-left">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{c.title}</h4>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <CalendarIcon size={14} /> 
                        {format(c.startDate, "dd MMM", { locale: ptBR })} - {format(c.endDate, "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.status === 'PLANNING' && isMarketingDir && (
                        <button 
                          type="button"
                          onClick={() => handleApproveCampaign(c, true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1 px-3 rounded-lg flex items-center gap-1 shadow-sm shrink-0 transition-all cursor-pointer"
                        >
                          Aprovar Campanha
                        </button>
                      )}

                      {c.status === 'ACTIVE' && isMarketingDir && (
                        <button 
                          type="button"
                          onClick={() => handleApproveCampaign(c, false)}
                          className="bg-yellow-150 hover:bg-yellow-250 text-yellow-905 text-[11px] font-bold py-1 px-3 rounded-lg flex items-center gap-1 shadow-sm shrink-0 transition-all font-mono cursor-pointer"
                        >
                          Recuar P/ Planejamento
                        </button>
                      )}

                      <button onClick={() => setEditingCampaign(c)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity p-1">
                        <Edit2 size={16} />
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        c.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        c.status === 'FINISHED' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {c.status === 'ACTIVE' ? 'Em Execução' : c.status === 'FINISHED' ? 'Finalizada' : 'Planejamento'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Gasto Atual</p>
                      <p className="font-semibold text-gray-900">R$ {c.spent.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ R$ {c.budget.toLocaleString()}</span></p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div className="bg-gray-800 h-1.5 rounded-full" style={{ width: `${Math.min((c.spent/(c.budget||1))*100, 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                      <p className="text-xs text-emerald-600 mb-1">Engajamento Atual</p>
                      <p className="font-semibold text-emerald-700">{c.engagement}%</p>
                    </div>
                  </div>
               </div>
             ))}
             {campaigns.length === 0 && <div className="p-8 text-center text-gray-500">Nenhuma campanha cadastrada.</div>}
           </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm h-fit">
           <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2"><CalendarIcon size={18} /> Google Calendar</h3>
           
           <div className="space-y-4">
              {calendarEvents.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500">Nenhum evento futuro encontrado no calendário.</div>
              ) : (
                calendarEvents.slice(0, 5).map(event => {
                  const evtTime = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date || Date.now());
                  return (
                    <div key={event.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {format(evtTime, "dd MMM, HH:mm", { locale: ptBR })}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{event.summary || 'Sem Título'}</p>
                      <a href={event.htmlLink} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline mt-2 inline-block">
                        Ver no Google Calendar
                      </a>
                    </div>
                  );
                })
              )}

              <button 
                onClick={handleCreateEvent}
                disabled={isScheduling}
                className="w-full mt-4 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-900 border border-gray-200 py-2.5 rounded-lg text-sm font-medium transition-colors border-dashed"
              >
                {isScheduling ? 'Agendando...' : '+ Agendar Post no Calendar'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
