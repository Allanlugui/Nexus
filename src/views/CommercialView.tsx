import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Purchase, Report } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Plus, 
  UploadCloud, 
  Paperclip, 
  Printer, 
  Check, 
  X, 
  Search, 
  Calendar, 
  FileCheck, 
  ShieldAlert, 
  PieChart, 
  AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateStandardPdf } from '../lib/pdfGenerator';
import { cn } from '../lib/utils';

export function CommercialView() {
  const { currentUser, users } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  
  // Reports State
  const [reportTitle, setReportTitle] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Budget states
  const [commBudgetLimit, setCommBudgetLimit] = useState<number>(0);
  const [newPurchaseDesc, setNewPurchaseDesc] = useState('');
  const [newPurchaseAmount, setNewPurchaseAmount] = useState('');

  const loadPurchases = async () => {
    try {
      const r = await fetch('/api/purchases');
      if (r.ok) {
        setPurchases(await r.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCommercialBudget = async () => {
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) {
        const budgets = await res.json();
        const commB = budgets.find((b: any) => b.month === '2026-05' && b.type === 'DEPARTMENT' && b.targetId === 'COMERCIAL');
        if (commB) {
          setCommBudgetLimit(commB.amount);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadReports = () => {
    fetch('/api/reports').then(r => r.json()).then(data => {
      setReports(data.filter((r: Report) => r.senderId === currentUser?.id || r.recipientId === currentUser?.id));
    });
  };

  useEffect(() => {
    loadReports();
    loadPurchases();
    fetchCommercialBudget();
  }, [currentUser]);

  const totalApprovedPurchases = purchases
    .filter(p => p.status === 'APPROVED' && p.department === 'COMERCIAL')
    .reduce((sum, p) => sum + p.value, 0);

  const budget = commBudgetLimit > 0 ? commBudgetLimit : 15000;
  const budgetSpent = totalApprovedPurchases;
  const budgetRemaining = Math.max(budget - budgetSpent, 0);
  const budgetPercentage = Math.min((budgetSpent / budget) * 100, 100);

  const handleRequestPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPurchaseDesc || !newPurchaseAmount) return;

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: currentUser?.id,
          requesterName: currentUser?.name || 'Comercial Staff',
          department: 'COMERCIAL',
          item: newPurchaseDesc,
          value: Number(newPurchaseAmount),
          status: 'PENDING',
          subArea: 'Geral',
          date: Date.now()
        })
      });
      if (res.ok) {
        alert("Solicitação de aquisição enviada para homologação do Diretor Financeiro!");
        setNewPurchaseDesc('');
        setNewPurchaseAmount('');
        loadPurchases();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprovePurchase = async (purchase: Purchase, approve: boolean) => {
    if (approve) {
      const maximumBudget = commBudgetLimit > 0 ? commBudgetLimit : 15000;
      const alreadySpent = purchases
        .filter(p => p.status === 'APPROVED' && p.department === 'COMERCIAL')
        .reduce((sum, p) => sum + p.value, 0);

      if (alreadySpent + purchase.value > maximumBudget) {
        alert(`Operação bloqueada: Não há limite de dotação orçamentária suficiente para o setor Comercial! Saldo Disponível: R$ ${(maximumBudget - alreadySpent).toLocaleString('pt-BR')}`);
        return;
      }
    }

    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...purchase,
          status: approve ? 'APPROVED' : 'REJECTED'
        })
      });
      if (res.ok) {
        alert(approve ? "Aquisição devidamente homologada e empenhada no orçamento!" : "Solicitação reprovada.");
        loadPurchases();
        fetchCommercialBudget();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle) return;

    let base64 = "";
    if (reportFile) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        base64 = ev.target?.result as string;
        await submitReport(base64);
      };
      reader.readAsDataURL(reportFile);
    } else {
      await submitReport("");
    }
  };

  const submitReport = async (fileData: string) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser?.id,
          recipientId: currentUser?.superiorId || 'root',
          title: reportTitle,
          content: '',
          fileName: reportFile ? reportFile.name : '',
          fileData: fileData
        })
      });
      if (res.ok) {
        alert("Ofício comercial enviado com sucesso para seu superior hierárquico!");
        setReportTitle('');
        setReportFile(null);
        loadReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      generateStandardPdf({
        title: 'NexusERP - Planejamento & Orçamento Setorial Comercial',
        generatedBy: currentUser?.name || 'Gestor Comercial',
        position: currentUser?.position || 'Comercial',
        fileName: `NexusERP_Comercial_Orçamento_${new Date().getTime()}.pdf`,
        sections: [
          {
            title: 'Resumo de Limites Orçamentários',
            content: [
              `Limite Dotação Anual/Mensal Comercial: R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              `Saldo Empenhado (Consumido): R$ ${budgetSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              `Saldo Disponível Atual: R$ ${budgetRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]
          },
          {
            title: 'Histórico de Solicitações de Aquisição',
            type: 'table',
            tableHead: ['Item Requerido', 'Requerente', 'Valor', 'Status'],
            tableBody: purchases
              .filter(p => p.department === 'COMERCIAL')
              .map(p => [
                p.item,
                p.requesterName,
                `R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                p.status === 'APPROVED' ? 'Empenhado' : p.status === 'REJECTED' ? 'Reprovado' : 'Auditando'
              ])
          }
        ]
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar PDF comercial.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Only directores, CEO, TI, or finance team can approve procurement requests
  const canApprovePurchases = () => {
    if (!currentUser) return false;
    const isDirectorOrCEO = currentUser.position === 'DIRETOR' || currentUser.position === 'CEO';
    const isTIOrFinance = currentUser.department === 'TI' || currentUser.department === 'FINANCEIRO';
    return isDirectorOrCEO || isTIOrFinance || currentUser.isSystemAdmin;
  };

  const activeReports = reports.filter(r => r.senderId === currentUser?.id || r.recipientId === currentUser?.id);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <PieChart className="text-blue-600" /> Planejamento Comercial & Orçamentos
          </h1>
          <p className="text-sm text-gray-550 mt-1">
            Controle de dotações orçamentárias do setor de vendas, emissão de ofícios diretores e aquisição de materiais institucionais.
          </p>
        </div>
        <button 
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf}
          className="disabled:opacity-50 cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-950 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs"
        >
          <Printer size={16} /> {isGeneratingPdf ? "Gerando..." : "Exportar Extrato Comercial"}
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Dotação Setorial Total</p>
          <h2 className="text-3xl font-black text-gray-950 mt-1">R$ {budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <span className="text-[10px] text-gray-500">Valor limite total alocado para compras e mídia</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Orçamento Consumido</p>
          <h2 className="text-3xl font-black text-blue-600 mt-1">R$ {budgetSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${budgetPercentage}%` }}></div>
          </div>
          <span className="text-[10px] text-gray-450 mt-1 block">Consumado {budgetPercentage.toFixed(1)}% do orçamento setorial</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Saldo de Limite Disponível</p>
          <h2 className="text-3xl font-black text-emerald-600 mt-1">R$ {budgetRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <span className="text-[10px] text-gray-500">Saldo atual para solicitações em aberto</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
        
        {/* Purchase lists & new request form */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col space-y-6">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5"><TrendingUp size={18} className="text-blue-600" /> Requisições de Aquisição Comercial</h3>
            <p className="text-xs text-gray-400 mt-0.5">Solicite materiais de marketing, softwares ou suporte ao setor de compras.</p>
          </div>

          <form onSubmit={handleRequestPurchase} className="bg-slate-50 border border-slate-205 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Solicitar Nova Compra</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input 
                  required 
                  placeholder="Nome do Item / Serviço..." 
                  value={newPurchaseDesc} 
                  onChange={e => setNewPurchaseDesc(e.target.value)} 
                  className="w-full border-gray-250 border rounded-lg p-2 text-xs bg-white text-gray-800 font-medium" 
                />
              </div>
              <div className="flex gap-2">
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  placeholder="Valor estimado (R$)..." 
                  value={newPurchaseAmount} 
                  onChange={e => setNewPurchaseAmount(e.target.value)} 
                  className="flex-1 border-gray-250 border rounded-lg p-2 text-xs bg-white text-gray-800 font-bold" 
                />
                <button type="submit" className="bg-gray-950 hover:bg-gray-850 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer">Enviar</button>
              </div>
            </div>
          </form>

          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">Histórico de Pedidos de Compra</h4>
            {purchases.filter(p => p.department === 'COMERCIAL').map((p) => {
              const dateObj = p.date ? new Date(p.date) : new Date();
              return (
                <div key={p.id} className="flex items-center justify-between p-3.5 bg-slate-55 border border-gray-200 rounded-xl">
                  <div className="space-y-1">
                    <h5 className="font-bold text-gray-900 text-xs">{p.item}</h5>
                    <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                      <span>Ref: {format(dateObj, "dd/MM/yyyy")}</span>
                      <span>•</span>
                      <span>Autor: {p.requesterName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-xs text-gray-950">R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    
                    {p.status === 'PENDING' && canApprovePurchases() ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleApprovePurchase(p, true)} className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-md" title="Autorizar despesa"><Check size={11} /></button>
                        <button onClick={() => handleApprovePurchase(p, false)} className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md" title="Reprovar despesa"><X size={11} /></button>
                      </div>
                    ) : (
                      <span className={`p-1 px-2 rounded-lg font-bold text-[9px] uppercase tracking-wide tracking-widest leading-none ${
                        p.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 
                        p.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-150' : 
                        'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      }`}>
                        {p.status === 'APPROVED' ? 'Empenhado' : p.status === 'REJECTED' ? 'Reprovado' : 'Sob Auditoria'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {purchases.filter(p => p.department === 'COMERCIAL').length === 0 && (
              <p className="text-gray-400 italic text-xs py-10 text-center flex items-center justify-center gap-1">
                <AlertCircle size={14} /> Nenhuma requisição de aquisição setorial em andamento.
              </p>
            )}
          </div>
        </div>

        {/* Commercial ofícios and reports reports */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col space-y-6">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5"><FileText size={18} className="text-blue-600" /> Ofícios & Relatórios de Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Transmita diretrizes periódicas, acordos fiscais ou apresentações comerciais ao superior.</p>
          </div>

          <form onSubmit={handleSendReport} className="bg-slate-50 border border-slate-205 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Expedir Ofício Comercial</h4>
            <div className="space-y-2">
              <input 
                required 
                placeholder="Título do Documento / Assunto..." 
                value={reportTitle} 
                onChange={e => setReportTitle(e.target.value)} 
                className="w-full border-gray-250 border rounded-lg p-2 text-xs bg-white text-gray-800 font-medium" 
              />
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 flex gap-2 items-center border border-dashed border-slate-300 p-1.5 px-3 rounded-lg bg-white">
                  <UploadCloud size={14} className="text-slate-400 shrink-0" />
                  <input type="file" onChange={(e) => setReportFile(e.target.files?.[0] || null)} className="text-[10px] text-slate-650 file:border-0 file:bg-gray-100" />
                  {reportFile && <span className="text-[9px] bg-slate-200 font-bold px-1.5 py-0.5 rounded text-slate-700 truncate max-w-[100px]">{reportFile.name}</span>}
                </div>
                <button type="submit" className="bg-gray-950 hover:bg-gray-850 text-white rounded-lg px-5 py-2 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer">Enviar Ofício</button>
              </div>
            </div>
          </form>

          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1 flex-1">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1.5">Livro de Ofícios Expedidos e Recebidos</h4>
            {activeReports.map((rep) => {
              const senderObj = users.find(u => u.id === rep.senderId);
              const recipientObj = users.find(u => u.id === rep.recipientId);
              
              return (
                <div key={rep.id} className="p-3.5 bg-slate-55 border border-gray-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-gray-900 text-xs">{rep.title}</h5>
                    <span className="text-[8px] bg-indigo-50 font-black tracking-widest font-mono p-0.5 px-1.5 border border-indigo-200 text-indigo-700 uppercase rounded">Expedido</span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center text-[10px] text-gray-500 pt-0.5 gap-2">
                    <div className="flex items-center gap-1 leading-none">
                      <span>De: <strong>{senderObj?.name || 'Comercial'}</strong></span>
                      <span>➔</span>
                      <span>Para: <strong>{recipientObj?.name || 'Diretoria'}</strong></span>
                    </div>

                    {rep.fileData && (
                      <a href={rep.fileData} download={rep.fileName || "oficio.pdf"} className="text-[10px] text-blue-650 hover:underline font-black flex items-center gap-0.5 font-sans">
                        <Paperclip size={11} /> Baixar Anexo ({rep.fileName})
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {activeReports.length === 0 && (
              <p className="text-gray-400 italic text-xs py-10 text-center flex items-center justify-center gap-1">
                <AlertCircle size={14} /> Nenhum ofício corporativo expedido ou recebido no momento.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
