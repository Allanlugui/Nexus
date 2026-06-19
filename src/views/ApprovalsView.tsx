import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ApprovalRequest, User } from '../types';
import { Check, X, Clock, FileText, Send, Printer, ShieldAlert, Award, FileCheck, DownloadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateStandardPdf } from '../lib/pdfGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ApprovalsView() {
  const { currentUser, users } = useAuth();
  const { socket } = useSocket();
  
  // Tab configuration: 'approvals' (General) or 'budgets' (Ratifications)
  const [activeTab, setActiveTab] = useState<'approvals' | 'budgets'>('approvals');

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<any[]>([]);
  
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Budget requests actions states
  const [rejectingBudgetId, setRejectingBudgetId] = useState<string | null>(null);
  const [budgetRejectionReason, setBudgetRejectionReason] = useState('');
  const [previewPdfUri, setPreviewPdfUri] = useState<string | null>(null);
  const [previewPdfName, setPreviewPdfName] = useState('');

  useEffect(() => {
    fetch('/api/approvals')
      .then(r => r.json())
      .then(data => setRequests(data));

    fetch('/api/budget-requests')
      .then(r => r.json())
      .then(data => setBudgetRequests(data));

    if (socket) {
      socket.on('approval:created', (req: ApprovalRequest) => {
        setRequests(prev => [req, ...prev]);
      });
      socket.on('approval:updated', (updatedReq: ApprovalRequest) => {
        setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
      });
      socket.on('budget-request:created', (req: any) => {
        setBudgetRequests(prev => [req, ...prev]);
      });
      socket.on('budget-request:updated', (updatedReq: any) => {
        setBudgetRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
      });
    }

    return () => {
      if (socket) {
        socket.off('approval:created');
        socket.off('approval:updated');
        socket.off('budget-request:created');
        socket.off('budget-request:updated');
      }
    }
  }, [socket]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: currentUser?.id,
        title: newTitle,
        description: newDesc,
        amount: Number(newAmount)
      })
    });
    setShowNew(false);
    setNewTitle('');
    setNewDesc('');
    setNewAmount('');
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
       if (!rejectReason.trim()) {
         alert("Por favor insira uma justificativa de recusa institucional.");
         return;
       }
       const r = await fetch(`/api/approvals/${id}/reject`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId: currentUser?.id, reason: rejectReason })
       });
       if (r.ok) {
         setRejectingId(null);
         setRejectReason('');
       } else {
         const err = await r.json();
         alert(err.error || "Houve uma falha ao rejeitar requisição.");
       }
       return;
    }
    
    const r = await fetch(`/api/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id })
    });
    if (!r.ok) {
      const err = await r.json();
      alert(err.error || "Houve uma falha ao aprovar requisição.");
    }
  };

  const handleAppeal = async (id: string) => {
    if (!appealReason.trim()) return;
    const r = await fetch(`/api/approvals/${id}/appeal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id, reason: appealReason })
    });
    if (r.ok) {
      setAppealingId(null);
      setAppealReason('');
    } else {
      const err = await r.json();
      alert(err.error || "Houve uma falha ao recursar.");
    }
  };

  // Check if current user is at the correct level to approve this budget ratification
  const getsBudgetApprovalSection = (req: any) => {
    if (req.status === 'APPROVED' || req.status === 'REJECTED') return null;

    // TI has master privilege - can approve any stage
    const isCEO = currentUser?.position.toUpperCase() === 'CEO' || currentUser?.position.toUpperCase().includes('PRESIDENTE') || !currentUser?.superiorId;
    if (currentUser?.department === 'TI' || isCEO) {
      const stageName = 
        req.status === 'PENDING_SUPERIOR' ? "Aprovação Superior Direto" :
        req.status === 'PENDING_FINANCE' ? "Autorização de Verbas (Financeiro)" : "Homologação";
      return { stage: `${stageName} (Acesso Master)`, actionLabel: "Assinar Homologação" };
    }

    // 1. PENDING_SUPERIOR: Requester's direct superior
    if (req.status === 'PENDING_SUPERIOR') {
      const reqUser = users.find(u => u.id === req.requesterId);
      if (reqUser && reqUser.superiorId === currentUser?.id) {
        return { stage: "Aprovação Superior Direto", actionLabel: `Assinar como Superior de ${reqUser.name.split(' ')[0]}` };
      }
    }

    // 2. PENDING_FINANCE: Needs Finance department approval
    if (req.status === 'PENDING_FINANCE') {
      if (currentUser?.department === 'FINANCEIRO') {
        return { stage: "Autorização de Verbas (Financeiro)", actionLabel: "Liberar Recursos & Assinar" };
      }
    }

    return null;
  };

  // Submit sign status or rejection on budget extra request
  const handleBudgetSignAction = async (requestId: string, approve: boolean) => {
    if (!approve && !budgetRejectionReason.trim()) {
      alert("Por favor, informe a justificativa de rejeição.");
      return;
    }

    try {
      const sigHash = `NEXUS-AUTH-STAMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      
      const res = await fetch(`/api/budget-requests/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          approve,
          rejectionReason: approve ? '' : budgetRejectionReason,
          signatureHash: sigHash
        })
      });

      if (res.ok) {
        const updatedRequest = await res.json();
        setRejectingBudgetId(null);
        setBudgetRejectionReason('');

        // If request status is fully APPROVED, now generate the pdf report and upload to VFS
        if (updatedRequest.status === 'APPROVED') {
          await generateAndSaveBudgetPdf(updatedRequest);
        } else {
          alert(`Fluxo de homologação atualizado! Assinatura registrada digitalmente: ${sigHash}`);
          // Reload
          fetch('/api/budget-requests')
            .then(r => r.json())
            .then(data => setBudgetRequests(data));
        }
      } else {
        alert("Falha ao registrar assinatura.");
      }
    } catch (err) {
      console.error(err);
      alert("Houve uma falha ao assinar homologação.");
    }
  };

  // Generate and display PDF certification
  const generateAndSaveBudgetPdf = async (req: any) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Top header band
      pdf.setFillColor(30, 58, 138); // Dark Navy
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("CERTIDÃO DE AUTORIZAÇÃO DE VERBA EXTRA", 15, 18);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`NEXUS ERP - SISTEMA FINANCEIRO SEGURO`, 15, 26);
      pdf.text(`DATA DE EMISSÃO: ${new Date(req.createdAt).toLocaleString('pt-BR')}`, 15, 32);

      // Metadata card
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("1. INFORMAÇÕES DA SOLICITAÇÃO", 15, 52);
      
      const metaRows = [
        ["Código do Documento", `REQ-VERBA-${req.id.substring(0, 8).toUpperCase()}`],
        ["Colaborador Requisitante", req.requesterName],
        ["Departamento / Setor", req.department],
        ["Projeto / Finalidade", req.projectName],
        ["Valor Extra Autorizado", `R$ ${req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ["Status Final", "CONCLUÍDO E HOMOLOGADO"]
      ];

      autoTable(pdf, {
        startY: 56,
        body: metaRows,
        theme: 'plain',
        bodyStyles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
      });

      const nextY = (pdf as any).lastAutoTable.finalY + 12;

      // Justification block
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("2. JUSTIFICATIVA E IMPORTÂNCIA GESTIONAL", 15, nextY);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const splitText = pdf.splitTextToSize(req.justification, pageWidth - 30);
      pdf.text(splitText, 15, nextY + 6);

      const justificationHeight = splitText.length * 5;
      const signaturesY = nextY + 12 + justificationHeight;

      // Draw horizontal gray divider
      pdf.setDrawColor(220, 224, 230);
      pdf.line(15, signaturesY, pageWidth - 15, signaturesY);

      // Signatures header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("3. ASSINATURAS COLETADAS & TRILHA DE AUDITORIA", 15, signaturesY + 8);

      // Format signature rows
      const signatureRows = req.signatures.map((s: any) => [
        s.userName,
        s.userPosition,
        s.userDepartment,
        new Date(s.timestamp).toLocaleString('pt-BR'),
        s.hash
      ]);

      autoTable(pdf, {
        startY: signaturesY + 12,
        head: [['Nome Completo', 'Cargo', 'Setor', 'Data/Hora', 'Chave de Autenticação']],
        body: signatureRows,
        headStyles: { fillColor: [71, 85, 105], fontSize: 9 },
        bodyStyles: { fontSize: 8 }
      });

      const finalTablesY = (pdf as any).lastAutoTable.finalY + 12;

      // QR Code
      const qrData = `https://ai.studio/build/nexus-erp/validate/${req.id}?authId=${req.signatures[req.signatures.length - 1]?.hash || 'verified'}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

      try {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("AUDITORIA DIGITAL E VALIDACÃO DE SEGURANÇA", 15, finalTablesY);
        
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text("Este documento está digitalmente assinado conforme normas de integridade financeira do Nexus ERP.", 15, finalTablesY + 5);
        pdf.text("Aponte a câmera para verificar o status de homologação do orçamento de verba extra em tempo real.", 15, finalTablesY + 9);

        pdf.addImage(qrUrl, 'PNG', pageWidth - 45, finalTablesY - 5, 30, 30);
      } catch (err) {
        console.error("Failed to add QR image to pdf", err);
      }

      // Add Footer on page 1
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Nexus ERP Security Seals | ID: ${req.id}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save locally & encode to base64 for automated VFS file upload
      const fileName = `VerbaExtra_${req.projectName.replace(/\s+/g, '_')}_${req.id.substring(0, 8)}.pdf`;
      const base64Data = pdf.output('datauristring');

      // Update state for inline visual previewing using secure Blob URL format to bypass browser iframe sandboxing
      try {
        const parts = base64Data.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        setPreviewPdfUri(blobUrl);
      } catch (convErr) {
        console.error("Blob URL conversion failed, falling back to raw URI:", convErr);
        setPreviewPdfUri(base64Data);
      }
      setPreviewPdfName(fileName);

      // Trigger automatic browser download
      pdf.save(fileName);

      // Upload PDF to server which automatically places it inside "<Requester> - <Position>/Orçamentos e Verbas"
      await fetch(`/api/budget-requests/${req.id}/save-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: req.requesterId,
          fileName,
          fileData: base64Data
        })
      });

      alert("Excelente! O orçamento extra de verba foi integralmente homologado e assinado por todas as hierarquias. O documento PDF foi gerado com sucesso, contendo o selo de auditoria, QR Code, e foi armazenado automaticamente na pasta do colaborador!");
      
      // Reload budget requests
      fetch('/api/budget-requests')
        .then(r => r.json())
        .then(data => setBudgetRequests(data));

    } catch (err) {
      console.error(err);
      alert("Erro ao processar fluxo e certificar PDF.");
    }
  };

  const statusMap: Record<string, { label: string, color: string }> = {
    'PENDING_SUPERIOR': { label: 'Aguardando Superior Direto', color: 'bg-blue-50 text-blue-750 border-blue-250' },
    'PENDING_FINANCE': { label: 'Aguardando Liberação Financeira', color: 'bg-orange-50 text-orange-755 border-orange-255' },
    'APPROVED': { label: 'Aprovado & Assinado', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    'REJECTED': { label: 'Rejeitado por Superior', color: 'bg-red-50 text-red-800 border-red-200' },
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    try {
      const totalAmount = requests.reduce((acc, req) => acc + req.amount, 0);
      generateStandardPdf({
        title: 'NexusERP - Relatório de Fluxo de Aprovações',
        generatedBy: currentUser?.name || 'Gestor de Aprovações',
        position: currentUser?.position || 'Administrativo',
        fileName: `NexusERP_Aprovacoes_${new Date().getTime()}.pdf`,
        sections: [
          {
            title: 'Resumo Geral das Movimentações',
            content: [
              `Total de Solicitações Geradas: ${requests.length}`,
              `Montante Solicitado: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              `Solicitações Aprovadas: ${requests.filter(r => r.status === 'APPROVED').length}`,
              `Solicitações Rejeitadas: ${requests.filter(r => r.status === 'REJECTED').length}`,
              `Solicitações em Análise: ${requests.filter(r => r.status.startsWith('PENDING')).length}`,
            ]
          },
          {
            title: 'Histórico Completo de Submissões',
            type: 'table',
            tableHead: ['Data', 'Criador', 'Título', 'Valor (R$)', 'Status Atual'],
            tableBody: requests.sort((a,b) => b.createdAt - a.createdAt).map(req => {
              const author = users.find(u => u.id === req.requesterId)?.name || 'Anônimo';
              return [
                format(req.createdAt, "dd/MM/yyyy HH:mm"),
                author,
                req.title,
                req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                statusMap[req.status]?.label || req.status
              ];
            })
          }
        ]
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF das aprovações.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 font-sans">
      
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileCheck className="text-blue-600" /> Fluxo de Homologação Institucional
          </h1>
          <p className="text-sm text-gray-550 mt-1">Trilha de conformidade oficial. Requisições dotação e financeiras sob validação sequencial hierárquica.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleGeneratePdf} 
            disabled={isGeneratingPdf}
            className="disabled:opacity-50 cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs"
          >
            <Printer size={16} /> {isGeneratingPdf ? 'Gerando...' : 'Exportar Fluxo'}
          </button>
          <button 
            onClick={() => setShowNew(!showNew)}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Nova Solicitação
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs overflow-hidden"
          >
            <h3 className="font-bold text-gray-900 mb-4 text-base">Requerer Aprovação Hierárquica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Título da Requisição</label>
                <input required placeholder="Ex: Aquisição emergencial de licenças" value={newTitle} onChange={e => setNewTitle(e.target.value)} type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custo Estimado (R$)</label>
                <input required placeholder="Ex: 4500" value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição e Justificativa de Uso</label>
                <textarea required placeholder="Justifique detalhadamente por que esta aquisição é crucial." value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancelar</button>
              <button type="submit" className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg flex items-center gap-1.5 hover:bg-blue-700 cursor-pointer shadow-xs">
                <Send size={13} /> Lançar para Análise
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-150 gap-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={cn(
            "px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer outline-none",
            activeTab === 'approvals' 
              ? "border-blue-600 text-blue-600 font-bold" 
              : "border-transparent text-gray-500 hover:text-gray-950"
          )}
        >
          <FileCheck size={16} /> Solicitações Operacionais ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={cn(
            "px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer outline-none",
            activeTab === 'budgets' 
              ? "border-blue-600 text-blue-600 font-bold" 
              : "border-transparent text-gray-500 hover:text-gray-950"
          )}
        >
          <Award size={16} /> Ratificações de Verba Extra ({budgetRequests.length})
        </button>
      </div>

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {requests.sort((a, b) => b.createdAt - a.createdAt).map(req => {
            const author = users.find(u => u.id === req.requesterId);
            
            let needsMyApproval = false;
            if (currentUser) {
              const hasCEO = currentUser.position.toUpperCase() === 'CEO' || currentUser.position.toUpperCase().includes('PRESIDENTE') || currentUser.position.toUpperCase().includes('ACIONISTA') || currentUser.position.toUpperCase().includes('CONSELHO');
              const hasDirector = currentUser.position.toUpperCase().includes('DIRETOR') || currentUser.position.toUpperCase().includes('GERENTE') || currentUser.position.toUpperCase().includes('GERAL') || currentUser.position.toUpperCase().includes('GENERAL');
              
              if (currentUser.department === 'TI') {
                needsMyApproval = (req.status !== 'APPROVED' && req.status !== 'REJECTED');
              } else if (req.status === 'PENDING_DIRECTOR') {
                needsMyApproval = (currentUser.id === author?.superiorId) || 
                                  (hasDirector && currentUser.department === author?.department) || 
                                  hasCEO;
              } else if (req.status === 'PENDING_FINANCE') {
                 needsMyApproval = (currentUser.department === 'FINANCEIRO') || hasCEO;
              } else if (req.status === 'PENDING_DIRETORIA_GERAL') {
                 needsMyApproval = (currentUser.department === 'ADMINISTRATIVO' && hasDirector) || hasCEO || hasDirector;
              } else if (req.status === 'PENDING_CEO') {
                 needsMyApproval = hasCEO;
              }
            }

            return (
              <motion.div 
                layout
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                key={req.id} 
                className="bg-white border text-left border-gray-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all relative overflow-hidden"
              >
                {/* Sequential Trace Visual Timeline */}
                <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                   <span className="text-gray-900 font-extrabold">Operacional</span>
                   <span className="text-gray-300">→</span>
                   <span className={cn(req.status === 'PENDING_DIRECTOR' ? "text-blue-600 underline font-extrabold" : (req.status !== 'REJECTED' ? "text-gray-700 font-semibold" : ""))}>1. Diretor</span>
                   <span className="text-gray-300">→</span>
                   <span className={cn(req.status === 'PENDING_FINANCE' ? "text-amber-600 underline font-extrabold" : (['PENDING_DIRETORIA_GERAL', 'PENDING_CEO', 'APPROVED'].includes(req.status) ? "text-gray-700 font-semibold" : ""))}>2. Financeiro</span>
                   <span className="text-gray-300">→</span>
                   <span className={cn(req.status === 'PENDING_DIRETORIA_GERAL' ? "text-purple-600 underline font-extrabold" : (['PENDING_CEO', 'APPROVED'].includes(req.status) ? "text-gray-700 font-semibold" : ""))}>3. Geral</span>
                   <span className="text-gray-300">→</span>
                   <span className={cn(req.status === 'PENDING_CEO' ? "text-rose-600 underline font-extrabold" : (req.status === 'APPROVED' ? "text-gray-700 font-semibold" : ""))}>4. CEO</span>
                   {req.status === 'APPROVED' && (
                     <>
                       <span className="text-gray-300">→</span>
                       <span className="text-emerald-600 bg-emerald-50 border border-emerald-250 p-1 px-2 rounded-lg font-black tracking-normal">✓ Homologado</span>
                     </>
                   )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border", statusMap[req.status]?.color)}>
                        {statusMap[req.status]?.label || req.status}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                        <Clock size={12} />
                        {format(req.createdAt, "dd 'de' MMM, HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{req.title}</h3>
                      <p className="text-sm text-gray-650 mt-1 whitespace-pre-wrap leading-relaxed">{req.description}</p>
                    </div>
                    
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-slide-up">
                         <ShieldAlert size={14} className="shrink-0 mt-0.5 text-red-600" />
                         <div>
                           <strong className="font-extrabold">Parecer de Rejeição Superior:</strong> {req.rejectionReason}
                         </div>
                      </div>
                    )}

                    {req.appealReason && req.status !== 'REJECTED' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                         <Award size={14} className="shrink-0 mt-0.5" />
                         <div>
                           <strong className="font-extrabold">Argumentação de Recurso:</strong> {req.appealReason}
                         </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2">
                         <img src={author?.avatarUrl} className="w-5 h-5 rounded-full border border-gray-200" alt="" />
                         <span className="text-gray-700 font-bold">{author?.name}</span>
                         <span className="text-gray-400 font-medium font-mono text-[10px] bg-white border border-gray-200 p-0.5 px-1.5 rounded-lg">De: {author?.department}</span>
                      </div>
                      <div className="h-4 w-px bg-gray-300"></div>
                      <div className="font-mono text-gray-950 font-black text-sm">
                        R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Cryptographic Auditing Signs Trace */}
                    {req.signatures && req.signatures.length > 0 && (
                      <div className="space-y-1.5 border-t border-gray-100 pt-3 animate-slide-up duration-200">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aprovações & Rubricas Digitais Integradas:</p>
                         <div className="space-y-1">
                           {req.signatures.map((sig, i) => (
                             <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-[#fdfdfd] rounded-lg border border-gray-200 text-[11px] text-gray-750">
                               <div className="flex items-center gap-1 font-semibold text-gray-900">
                                 <Check size={11} className="text-emerald-600 font-bold shrink-0" />
                                 <span>{sig.userName}</span>
                                 <span className="text-[10px] text-gray-400 font-normal">({sig.userPosition} - {sig.userDepartment})</span>
                               </div>
                               <div className="font-mono text-[9px] text-gray-400 shrink-0 text-right">
                                 <span>{format(sig.timestamp, "dd/MM/yy HH:mm")}</span>
                                 <span className="hidden md:inline"> | Hash: {sig.hash.substring(0, 16)}</span>
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}
                    
                    {req.status === 'REJECTED' && currentUser?.id === req.requesterId && (
                      <div className="border-t border-gray-100 pt-3">
                        {appealingId === req.id ? (
                           <div className="flex flex-col gap-2">
                             <textarea 
                               autoFocus
                               className="w-full text-xs border border-gray-355 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 bg-white" 
                               rows={2} 
                               placeholder="Exponha uma justificativa do porquê sua dotação orçamentária deve ser revista..."
                               value={appealReason}
                               onChange={e => setAppealReason(e.target.value)}
                             />
                             <div className="flex justify-end gap-1.5 pt-1.5">
                               <button onClick={() => setAppealingId(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">Cancelar</button>
                               <button onClick={() => handleAppeal(req.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">Enviar Contestação</button>
                             </div>
                           </div>
                        ) : (
                           <button onClick={() => setAppealingId(req.id)} className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer">
                             Abrir Pedido de Recurso de Verbas
                           </button>
                        )}
                      </div>
                    )}
                  </div>

                  {needsMyApproval && (
                    <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-start bg-gray-50/50 p-3 border border-gray-150 rounded-2xl">
                      {rejectingId === req.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px] animate-slide-up">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Justificativa da Recusa</label>
                          <input 
                            autoFocus
                            type="text" 
                            className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-red-500 outline-none bg-white" 
                            placeholder="Ex: Valor excede o esperado..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                          />
                          <div className="flex gap-2 pt-1">
                             <button onClick={() => handleAction(req.id, 'reject')} className="flex-1 bg-red-600 text-white text-[11px] font-bold py-1.5 rounded-lg hover:bg-red-700 cursor-pointer">Rejeitar</button>
                             <button onClick={() => setRejectingId(null)} className="flex-1 bg-gray-200 text-gray-700 text-[11px] font-bold py-1.5 rounded-lg hover:bg-gray-300 cursor-pointer">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[9px] font-black uppercase text-gray-600 tracking-wider text-center hidden sm:block">Ações Institucionais</p>
                          <button onClick={() => handleAction(req.id, 'approve')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-250 rounded-lg text-xs font-bold transition-all cursor-pointer">
                            <Check size={14} /> Rubricar & Assinar
                          </button>
                          <button onClick={() => setRejectingId(req.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 h-9 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-250 rounded-lg text-xs font-bold transition-all cursor-pointer">
                            <X size={14} /> Recusar Pedido
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          {requests.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed space-y-3">
              <FileText className="mx-auto text-gray-300" size={36} />
              <p className="text-gray-500 font-semibold text-sm">Nenhuma solicitação operacional catalogada.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'budgets' && (
        <div className="space-y-4 animate-fade-in">
          {budgetRequests.sort((a,b) => b.createdAt - a.createdAt).map(req => {
            const appInfo = getsBudgetApprovalSection(req);
            
            return (
              <motion.div 
                key={req.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-6 rounded-2xl border bg-white shadow-xs space-y-4 transition-all duration-200 text-left",
                  appInfo ? "border-amber-200 ring-2 ring-amber-50" : "border-gray-200"
                )}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-150 font-bold">
                        REQ-VERBA-EXTRA
                      </span>
                      <span className="text-xs text-gray-455">• Criado por <strong>{req.requesterName}</strong> ({req.department})</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base mt-1">Projeto: {req.projectName}</h3>
                  </div>
                  
                  <span className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full border shrink-0",
                    req.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-150" : 
                    req.status === 'REJECTED' ? "bg-rose-50 text-rose-705 border-rose-150" : 
                    "bg-amber-50 text-amber-105 border-amber-150"
                  )}>
                    {req.status === 'APPROVED' ? 'Aprovado & Assinado' : 
                     req.status === 'REJECTED' ? 'Recusado' : 
                     'Em Homologação'}
                  </span>
                </div>

                {/* Justification & Financial value */}
                <div className="bg-gray-50 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-gray-100">
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Justificativa e Destinação:</p>
                    <p className="text-xs text-gray-650 mt-1 italic font-medium">"{req.justification}"</p>
                  </div>
                  <div className="text-left md:text-right shrink-0">
                    <p className="text-[10px] font-black uppercase text-gray-455 tracking-wider font-semibold">Acréscimo de Orçamento:</p>
                    <p className="text-xl font-bold text-gray-900 tracking-tight font-mono">
                      R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Signature Trial tracks */}
                {req.signatures && req.signatures.length > 0 && (
                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <p className="text-[10px] font-black text-gray-455 uppercase tracking-widest">Trilha de Assinatura e Rubricas Digitais:</p>
                    <div className="space-y-1">
                      {req.signatures.map((sig: any, idx: number) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-[#fdfdfd] rounded-lg border border-gray-200 text-[11px] text-gray-750">
                          <div className="flex items-center gap-1 font-semibold text-gray-900">
                            <Check size={11} className="text-emerald-600 font-bold shrink-0" />
                            <span>{sig.userName}</span>
                            <span className="text-[10px] text-gray-400 font-normal">({sig.userPosition} - {sig.userDepartment})</span>
                          </div>
                          <div className="font-mono text-[9px] text-gray-400 shrink-0 text-right">
                            <span>{format(new Date(sig.timestamp), "dd/MM/yy HH:mm")}</span>
                            <span className="hidden md:inline"> | Hash: {sig.hash.substring(0, 16)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Certificate preview/recreation */}
                {req.status === 'APPROVED' && (
                  <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => generateAndSaveBudgetPdf(req)}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-semibold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <FileText size={14} /> Pré-visualizar / Recriar Certidão
                    </button>
                  </div>
                )}

                {/* Action Section */}
                {appInfo && (
                  <div className="pt-3 border-t border-gray-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/35 p-3 rounded-xl border border-amber-100">
                    <div>
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                        <ShieldAlert size={12} /> Assinatura Digital Necessária
                      </p>
                      <p className="text-[11px] font-bold text-gray-700 mt-0.5">Estágio Atual: {appInfo.stage}</p>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {rejectingBudgetId === req.id ? (
                        <div className="flex flex-col gap-2 w-full sm:w-64 bg-white p-2.5 rounded-xl border border-gray-205 shadow-xs">
                          <input 
                            required
                            type="text"
                            placeholder="Motivo do Indeferimento..."
                            value={budgetRejectionReason}
                            onChange={e => setBudgetRejectionReason(e.target.value)}
                            className="border border-gray-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBudgetSignAction(req.id, false)}
                              className="flex-1 bg-red-600 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-red-700 cursor-pointer"
                            >
                              Indeferir
                            </button>
                            <button
                              onClick={() => setRejectingBudgetId(null)}
                              className="flex-1 bg-gray-200 text-gray-700 text-[10px] font-bold py-1.5 rounded-lg hover:bg-gray-350 cursor-pointer"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleBudgetSignAction(req.id, true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 h-9 bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-250 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <Check size={14} fill="currentColor" /> {appInfo.actionLabel}
                          </button>
                          <button
                            onClick={() => setRejectingBudgetId(req.id)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 h-9 bg-rose-50 text-rose-705 hover:bg-rose-100 border border-rose-250 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <X size={14} /> Indeferir Recurso
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
          {budgetRequests.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed space-y-3">
              <FileText className="mx-auto text-gray-300" size={36} />
              <p className="text-gray-550 font-semibold text-sm">Nenhuma ratificação financeira catalogada.</p>
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Modal Container */}
      {previewPdfUri && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-250">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-55">
              <div>
                <h3 className="font-bold text-gray-905 text-sm flex items-center gap-2">
                  <FileText className="text-blue-600" size={18} /> Visualizador de Certidão Digital (Homologação)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{previewPdfName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewPdfUri} 
                  download={previewPdfName}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                >
                  <DownloadCloud size={14} /> Baixar Certidão
                </a>
                <button 
                  onClick={() => {
                    setPreviewPdfUri(null);
                    setPreviewPdfName('');
                  }}
                  className="text-gray-550 hover:bg-gray-105 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Document display frame */}
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative p-1">
              <iframe 
                src={previewPdfUri} 
                className="w-full h-full rounded-b-lg border-none"
                title="Certificado"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
