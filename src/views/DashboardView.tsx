import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Clock, CheckCircle2, XCircle, TrendingUp, Users, Printer, FileText, DownloadCloud, Search, PiggyBank, AlertCircle } from 'lucide-react';
import { ApprovalRequest, User, BudgetRequest } from '../types';
import { generateStandardPdf } from '../lib/pdfGenerator';

export function DashboardView() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<any>({
    activeUsers: 0,
    totalApprovals: 0,
    pendingValue: 0
  });
  const [receivedReports, setReceivedReports] = useState<any[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'budget' | 'general'>('budget');
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const hasFullAccess = (
      currentUser.position.toUpperCase() === 'CEO' ||
      currentUser.position.toUpperCase().includes('PRESIDENTE') ||
      currentUser.position.toUpperCase().includes('ACIONISTA') ||
      currentUser.position.toUpperCase().includes('CONSELHO') ||
      currentUser.position.toUpperCase().includes('DIRETOR') ||
      currentUser.department === 'ADMINISTRATIVO' ||
      currentUser.department === 'TI' ||
      currentUser.department === 'DIRETORIA'
    );

    Promise.all([
      fetch('/api/users'),
      fetch('/api/approvals'),
      fetch('/api/reports'),
      fetch('/api/budget-requests')
    ])
      .then(async ([resUsers, resApprovals, resReports, resBudgetRequests]) => {
         const users: User[] = await resUsers.json();
         const approvals: ApprovalRequest[] = await resApprovals.json();
         const allReports: any[] = await resReports.json();
         const budgets: BudgetRequest[] = await resBudgetRequests.json();
         
         const visibleBudgets = budgets.filter(b => {
           if (hasFullAccess) return true;
           return b.department === currentUser?.department || b.requesterId === currentUser?.id;
         });

         const visibleApprovals = approvals.filter(a => {
           if (hasFullAccess) return true;
           const requester = users.find(u => u.id === a.requesterId);
           return requester?.department === currentUser?.department || a.requesterId === currentUser?.id;
         });

         setApprovalRequests(visibleApprovals);
         setBudgetRequests(visibleBudgets);
         
         const pendingValue = visibleApprovals
          .filter(a => a.status.startsWith('PENDING'))
          .reduce((sum, a) => sum + a.amount, 0) +
          visibleBudgets
          .filter(b => b.status.startsWith('PENDING'))
          .reduce((sum, b) => sum + b.amount, 0);

         setStats({
           activeUsers: users.length,
           totalApprovals: visibleApprovals.length + visibleBudgets.length,
           pendingValue
         });

         const myReports = allReports.filter(r => r.recipientId === currentUser?.id).sort((a,b) => b.date - a.date);
         setReceivedReports(myReports);
      });
  }, [currentUser?.id, currentUser?.department, currentUser?.position]);

  const handleGeneratePdf = async () => {
    if (currentUser?.position !== 'CEO' && currentUser?.position !== 'DIRETOR' && currentUser?.department !== 'TI') {
      alert('Acesso negado. Somente administradores (CEO, TI, Diretores) podem gerar o relatório geral.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const [resUsers, resTasks, resCampaigns, resApprovals, resDocs, resSales, resReports, resMessages] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/tasks'),
        fetch('/api/campaigns'),
        fetch('/api/approvals'),
        fetch('/api/vfs/files'),
        fetch('/api/sales'),
        fetch('/api/reports'),
        fetch('/api/messages')
      ]);

      const [usersData, tasksData, campaignsData, approvalsData, docsData, salesData, reportsData, messagesData] = await Promise.all([
        resUsers.json(),
        resTasks.json(),
        resCampaigns.json(),
        resApprovals.json(),
        resDocs.json(),
        resSales.json(),
        resReports.json(),
        resMessages.json()
      ]);

      const sections = [
        {
          title: '1. Administrativo & Recursos Humanos',
          content: [
            `Total de Colaboradores Registrados: ${usersData.length} funcionários cadastrados.`,
            `Desempenho de Tarefas da Equipe: \n- ${tasksData.length} tarefas totais documentadas\n- ${tasksData.filter((t:any) => t.status === 'DONE').length} tarefas plenamente concluídas\n- ${tasksData.filter((t:any) => t.status === 'TODO').length} tarefas em backlog (pendentes)\n- ${tasksData.filter((t:any) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length} tarefas em andamento/revisão`
          ]
        },
        {
          title: '2. Comercial & Vendas',
          content: [
            `Volume de Vendas: ${salesData.length} negociações formalizadas na plataforma.`,
            `Faturamento Total Registrado: R$ ${salesData.reduce((sum:number, s:any) => sum + s.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `Relatórios de Desempenho Emitidos: ${reportsData.length} relatórios gerados pelos times de venda/gestão.`
          ]
        },
        {
          title: '3. Marketing & Ações',
          content: [
            `Campanhas Inseridas (Total): ${campaignsData.length} frentes de marketing ativas ou documentadas.`,
            `Orçamento Total (Budget Previsto): R$ ${campaignsData.reduce((sum:number, c:any) => sum + c.budget, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `Consumo Atual de Verba (Gasto Efetivo): R$ ${campaignsData.reduce((sum:number, c:any) => sum + c.spent, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ]
        },
        {
          title: '4. Governança Corporativa e Aprovações',
          content: [
            `Registros de Solicitações: ${approvalsData.length} submissões gerais no histórico (Sendo ${approvalsData.filter((a:any) => new Date(a.createdAt).getMonth() === new Date().getMonth() && new Date(a.createdAt).getFullYear() === new Date().getFullYear()).length} criadas estritamente neste mês base).`,
            `Impacto Financeiro Solicitado: R$ ${approvalsData.reduce((sum:number, a:any) => sum + a.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de requisições de caixa.`,
            `Sinteze de Status Operacional:\n- Aprovadas: ${approvalsData.filter((a:any) => a.status === 'APPROVED').length}\n- Rejeitadas (Com Motivo): ${approvalsData.filter((a:any) => a.status === 'REJECTED').length}\n- Pendências Avaliativas (Financeiro/Diretoria): ${approvalsData.filter((a:any) => a.status.startsWith('PENDING')).length}`
          ]
        },
        {
          title: '5. Infraestrutura, Documentos e Integrações Setoriais',
          content: [
            `Inventário de Documentos na Nuvem (Google Drive Integrado): ${docsData.length || 0} artefatos listados no cofre digital.`,
            `Tráfego de Comunicações Internas: ${messagesData.length} trocas de mensagens na intranet do sistema.`
          ]
        },
        {
          title: 'Detalhamento Estrutural: Quadro Funcional Ativo',
          type: 'table' as const,
          tableHead: ['Colaborador', 'E-mail', 'Departamento', 'Cargo Atual'],
          tableBody: usersData.map((u:any) => [u.name, u.email, u.department, u.position])
        },
        {
          title: 'Detalhamento Recente: Solicitações de Budget & Recursos',
          type: 'table' as const,
          tableHead: ['Título Requisicional', 'Requisitante', 'Volume Financeiro', 'Status Final', 'Data Base'],
          tableBody: approvalsData.slice(0, 20).map((a:any) => [
            a.title,
            usersData.find((u:any) => u.id === a.requesterId)?.name || 'N/D',
            `R$ ${a.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            a.status === 'APPROVED' ? 'APROVADO' : a.status === 'REJECTED' ? 'REJEITADO' : 'PENDENTE',
            new Date(a.createdAt).toLocaleDateString('pt-BR')
          ])
        }
      ];

      generateStandardPdf({
        title: 'Relatório Geral do Sistema',
        generatedBy: currentUser?.name || 'Administrador',
        position: currentUser?.position,
        sections,
        fileName: `NexusERP_Relatorio_Geral_${new Date().getTime()}.pdf`
      });
    } catch (error) {
      console.error('Erro ao gerar PDF', error);
      alert('Não foi possível gerar o PDF do relatório geral.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto print:p-0 print:m-0" ref={dashboardRef}>
       <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">Olá, {currentUser?.name.split(' ')[0]} 👋</h1>
            <p className="text-sm text-gray-500 mt-1 font-sans">Bem-vindo(a) ao Dashboard do seu {currentUser?.department}. Veja o panorama da empresa hoje.</p>
          </div>
          <button 
            onClick={handleGeneratePdf} 
            disabled={isGeneratingPdf}
            className="print:hidden disabled:opacity-50 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
             <Printer size={16} /> {isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
               <Users size={24} />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Colaboradores Integrados</p>
               <h3 className="text-2xl font-bold text-gray-900 font-mono">{stats.activeUsers}</h3>
             </div>
           </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
               <Activity size={24} />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Fluxos de Aprovação Ativos</p>
               <h3 className="text-2xl font-bold text-gray-900 font-mono">{stats.totalApprovals}</h3>
             </div>
           </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
               <TrendingUp size={24} />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-500">Capital Transitando</p>
               <h3 className="text-2xl font-bold text-gray-900 font-mono">
                 R$ {stats.pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
               </h3>
             </div>
           </div>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
         <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
           <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
             <FileText size={18} className="text-blue-600"/> Caixa de Relatórios
           </h3>
           <div className="space-y-4 max-h-[300px] overflow-y-auto">
             {receivedReports.length === 0 ? (
               <p className="text-sm text-gray-500 text-center py-4">Nenhum relatório recebido.</p>
             ) : (
               receivedReports.map(report => (
                 <div key={report.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <h4 className="font-medium text-sm text-gray-900">{report.title}</h4>
                     <span className="text-xs text-gray-500">{new Date(report.date).toLocaleDateString('pt-BR')}</span>
                   </div>
                   {report.content && <p className="text-xs text-gray-600 mb-3 whitespace-pre-wrap">{report.content}</p>}
                   {report.fileName && (
                     <div className="flex items-center gap-2">
                       <button onClick={() => {
                          const newWindow = window.open();
                          if (newWindow) {
                            if (report.fileName.includes('pdf') || report.fileData.startsWith('data:image')) {
                              newWindow.document.write(`<iframe src="${report.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                            } else {
                               newWindow.document.write(`
                                 <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                                   <h2 style="color:#333;">Pré-visualização Indisponível</h2>
                                   <p style="color:#666;">Este tipo de formato não pode ser visualizado diretamente no navegador.</p>
                                   <a href="${report.fileData}" download="${report.fileName}" style="padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:5px; margin-top:20px;">Baixar Arquivo Seguramente</a>
                                 </div>
                               `);
                            }
                          }
                       }} className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors">
                         <Search size={14} /> Visualizar
                       </button>
                       <a href={report.fileData || '#'} download={report.fileName} className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                         <DownloadCloud size={14} /> Baixar
                       </a>
                     </div>
                   )}
                 </div>
               ))
             )}
           </div>
         </div>
         
         <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col min-h-[300px]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3 mb-4 gap-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity size={18} className="text-emerald-500" /> Fluxo de Homologação Institucional
              </h3>
              <div className="flex gap-1 bg-gray-10 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('budget')} 
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'budget' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Verbas Extras ({budgetRequests.filter(b => b.status.startsWith('PENDING')).length})
                </button>
                <button 
                  onClick={() => setActiveTab('general')} 
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Gerais ({approvalRequests.filter(a => a.status.startsWith('PENDING')).length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[320px] space-y-3 pr-1 text-left">
              {activeTab === 'budget' ? (
                budgetRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="mx-auto text-gray-300 mb-2" size={24} />
                    <p className="text-xs text-gray-400">Nenhuma solicitação de verba extra em fluxo.</p>
                  </div>
                ) : (
                  budgetRequests.map(req => (
                    <div key={req.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/40 hover:bg-gray-50 transition-colors flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">REQ#{req.id.substring(0, 6).toUpperCase()}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                            req.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-750 font-medium'
                          }`}>
                            {req.status === 'PENDING_SUPERIOR' ? 'Superior Direto' :
                             req.status === 'PENDING_FINANCE' ? 'Analista Fin.' :
                             req.status === 'PENDING_FIN_SUPERIOR' ? 'Gestor Fin.' :
                             req.status === 'PENDING_FIN_DIR' ? 'Dir. Financeira' :
                             req.status === 'PENDING_GEN_DIR' ? 'Dir. Geral' :
                             req.status === 'PENDING_CEO' ? 'Aprovação CEO' :
                             req.status === 'APPROVED' ? 'Homologado' : 'Rejeitado'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-900 mt-1 truncate">{req.projectName}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">Por: {req.requesterName} ({req.department})</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-gray-900 font-mono">R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-[9px] text-gray-400 mt-1">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                approvalRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="mx-auto text-gray-300 mb-2" size={24} />
                    <p className="text-xs text-gray-400">Nenhuma demanda geral em processamento.</p>
                  </div>
                ) : (
                  approvalRequests.map(req => (
                    <div key={req.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/40 hover:bg-gray-50 transition-colors flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 font-mono uppercase font-semibold">DEM#{req.id.substring(0,6).toUpperCase()}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                            req.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-900 mt-1 truncate">{req.title}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{req.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {req.amount > 0 && <div className="text-xs font-bold text-gray-900 font-mono">R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                        <div className="text-[9px] text-gray-400 mt-1">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
         </div>
       </div>
    </div>
  );
}
