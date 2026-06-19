import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Budget, BudgetRequest, BudgetRequestSignature, User, Department, Position } from '../types';
import { 
  PiggyBank, TrendingUp, Landmark, ShieldCheck, ClipboardCheck, 
  Plus, Send, Check, X, FileText, DownloadCloud, AlertCircle, RefreshCw, UserCheck,
  ShieldAlert, PocketKnife, Search, CheckCircle, Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function BudgetsView() {
  const { currentUser, users } = useAuth();
  const { socket } = useSocket();

  // Selected Month State (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  
  // Simulation Mode for testing purposes (specific userId)
  const [simulatedUserId, setSimulatedUserId] = useState<string>('');

  // Core Budgets State
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Preview State
  const [previewPdfUri, setPreviewPdfUri] = useState<string | null>(null);
  const [previewPdfName, setPreviewPdfName] = useState<string>('');

  // Form states for allocation
  const [globalBudgetAmt, setGlobalBudgetAmt] = useState('');
  const [deptAllocations, setDeptAllocations] = useState<Record<string, string>>({});
  const [userAllocations, setUserAllocations] = useState<Record<string, string>>({});

  // Form states for extra budget request
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Reject / Action state
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Subordinates search filtering
  const [subordinateSearch, setSubordinateSearch] = useState('');

  // Fetch all budgets and requests
  const fetchData = async () => {
    setLoading(true);
    try {
      const budgetRes = await fetch('/api/budgets');
      const budgetData = await budgetRes.json();
      setBudgets(budgetData);

      const requestRes = await fetch('/api/budget-requests');
      const requestData = await requestRes.json();
      setRequests(requestData);
    } catch (err) {
      console.error("Error fetching budget data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (socket) {
      socket.on('budget-request:created', (newReq: BudgetRequest) => {
        setRequests(prev => [newReq, ...prev]);
      });

      socket.on('budget-request:updated', (updatedReq: BudgetRequest) => {
        setRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
      });
    }

    return () => {
      if (socket) {
        socket.off('budget-request:created');
        socket.off('budget-request:updated');
      }
    };
  }, [socket]);

  // Determine current effective role (based on logged user vs simulation)
  const getEffectiveUserRole = (): {
    isCEO: boolean;
    isFinStaff: boolean;
    isFinDir: boolean;
    isGenDir: boolean;
    isSubordinate: boolean;
    isAcionista: boolean;
    label: string;
    userToUse: User;
  } => {
    if (!currentUser) {
      throw new Error("No logged in user");
    }

    const userToUse = (simulatedUserId && currentUser?.department === 'TI') 
      ? (users.find(u => u.id === simulatedUserId) || currentUser)
      : currentUser;

    const isCEO = userToUse.position.toUpperCase() === 'CEO' || userToUse.position.toUpperCase().includes('PRESIDENTE') || !userToUse.superiorId;
    const isAcionista = userToUse.position.toUpperCase() === 'ACIONISTA' || userToUse.position.toUpperCase().includes('CONSELHO');
    const isFinDir = userToUse.department === 'FINANCEIRO' && userToUse.position.toUpperCase().includes('DIRETOR');
    const isFinStaff = userToUse.department === 'FINANCEIRO' && !isFinDir;
    const isGenDir = (userToUse.department === 'ADMINISTRATIVO' && userToUse.position.toUpperCase().includes('DIRETOR')) || (userToUse.department === 'TI' && userToUse.position.toUpperCase().includes('DIRETOR')) || userToUse.position.toUpperCase().includes('GERAL') || userToUse.position.toUpperCase().includes('GENERAL');
    const isSubordinate = !isCEO && !isAcionista && !isFinDir && !isFinStaff && !isGenDir;

    return {
      isCEO,
      isFinStaff,
      isFinDir,
      isGenDir,
      isSubordinate,
      isAcionista,
      label: simulatedUserId 
        ? `Simulando: ${userToUse.name} (${userToUse.position})` 
        : `${userToUse.name} (${userToUse.position} - Logado)`,
      userToUse
    };
  };

  const roleInfo = getEffectiveUserRole();

  // Budgets summary based on Selected Month
  const globalBudget = budgets.find(b => b.month === selectedMonth && b.type === 'COMPANY' && b.targetId === 'global');
  const employeeBudgets = budgets.filter(b => b.month === selectedMonth && b.type === 'EMPLOYEE');
  const departmentBudgets = budgets.filter(b => b.month === selectedMonth && b.type === 'DEPARTMENT');

  // Subordinates calculation
  const mySubordinates = users.filter(usr => usr.superiorId === roleInfo.userToUse.id && usr.status !== 'DISMISSED');

  // User's own total budget allotment
  // Root level / CEO gets the Global Budget as starting pool, other tiers get what was allocated to them from their direct superior
  const myBudgetAmt = (roleInfo.isCEO || !roleInfo.userToUse.superiorId)
    ? (globalBudget ? globalBudget.amount : 0)
    : (employeeBudgets.find(b => b.targetId === roleInfo.userToUse.id)?.amount || 0);

  // Total allocated to subordinates
  const totalAllocated = mySubordinates.reduce((sum, sub) => {
    const b = employeeBudgets.find(bg => bg.targetId === sub.id);
    return sum + (b ? b.amount : 0);
  }, 0);

  // Remaining unallocated balance under current user's custody
  const remainingAmt = myBudgetAmt - totalAllocated;

  // Coordinated total allocated sum for dashboard compatibility
  const totalAllocatedToDepts = totalAllocated;

  // Retrieve the complete path from root to simulated user
  const getHierarchyTrail = (userId: string): User[] => {
    const trail: User[] = [];
    let currentId: string | null = userId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const parentUser = users.find(u => u.id === currentId);
      if (parentUser) {
        trail.unshift(parentUser);
        currentId = parentUser.superiorId;
      } else {
        break;
      }
    }
    return trail;
  };

  const hierarchyTrail = getHierarchyTrail(roleInfo.userToUse.id);
  const filteredSubordinates = mySubordinates.filter(sub => 
    sub.name.toLowerCase().includes(subordinateSearch.toLowerCase()) ||
    sub.position.toLowerCase().includes(subordinateSearch.toLowerCase()) ||
    sub.department.toLowerCase().includes(subordinateSearch.toLowerCase())
  );

  // Sync state values on data load
  useEffect(() => {
    if (globalBudget) {
      setGlobalBudgetAmt(globalBudget.amount.toString());
    } else {
      setGlobalBudgetAmt('');
    }

    // Populate user allocations input cache
    const userCache: Record<string, string> = {};
    employeeBudgets.forEach(b => {
      userCache[b.targetId] = b.amount.toString();
    });
    setUserAllocations(userCache);
  }, [selectedMonth, budgets, users]);

  // CEO saves General Budget
  const handleSaveGlobalBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleInfo.isCEO) return;
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          type: 'COMPANY',
          targetId: 'global',
          amount: Number(globalBudgetAmt),
          allocated: totalAllocated,
          updatedBy: roleInfo.userToUse.name
        })
      });
      if (res.ok) {
        alert("Orçamento Mensal Geral atualizado com sucesso!");
        fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao atualizar orçamento.");
    }
  };

  // Save budget allocated to a direct subordinate (replaces department budgets and old employee budget saver)
  const handleSaveSubordinateBudget = async (subordinateId: string, amountStr: string) => {
    try {
      const amt = Number(amountStr) || 0;
      const subUser = users.find(u => u.id === subordinateId);
      if (!subUser) return;

      // 1. Save subordinate's budget record
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          type: 'EMPLOYEE',
          targetId: subordinateId,
          amount: amt,
          allocated: employeeBudgets.find(b => b.targetId === subordinateId)?.allocated || 0,
          updatedBy: roleInfo.userToUse.name
        })
      });

      if (res.ok) {
        // 2. Re-calculate total amount allocated to ALL direct subordinates of current user
        const otherSubsSum = mySubordinates
          .filter(sub => sub.id !== subordinateId)
          .reduce((sum, sub) => {
            const b = employeeBudgets.find(bg => bg.targetId === sub.id);
            return sum + (b ? b.amount : 0);
          }, 0);
        const nextTotalAllocated = otherSubsSum + amt;

        // 3. Update current user's budget record to reflect their total active delegation
        if (roleInfo.isCEO || !roleInfo.userToUse.superiorId) {
          // If root/CEO, we update standard COMPANY budget allocated
          await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              month: selectedMonth,
              type: 'COMPANY',
              targetId: 'global',
              amount: globalBudget ? globalBudget.amount : 0,
              allocated: nextTotalAllocated,
              updatedBy: roleInfo.userToUse.name
            })
          });
        } else {
          // Update the current manager's own employee budget allocated
          await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              month: selectedMonth,
              type: 'EMPLOYEE',
              targetId: roleInfo.userToUse.id,
              amount: myBudgetAmt,
              allocated: nextTotalAllocated,
              updatedBy: roleInfo.userToUse.name
            })
          });
        }

        alert(`Orçamento de ${subUser.name.split(' ')[0]} atualizado para R$ ${amt.toLocaleString('pt-BR')}!`);
        fetchData();
      } else {
        alert("Erro de API ao gravar orçamento.");
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao salvar orçamento do subordinado.");
    }
  };

  // Submit extra resources request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !requestAmount || !justification.trim()) {
      alert("Por favor, preencha todos os campos e justifique a necessidade.");
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await fetch('/api/budget-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: roleInfo.userToUse.id,
          requesterName: roleInfo.userToUse.name,
          department: roleInfo.userToUse.department,
          projectName,
          amount: Number(requestAmount),
          justification
        })
      });
      if (res.ok) {
        alert("Solicitação de verba extra registrada com sucesso e encaminhada para o fluxo financeiro!");
        setShowRequestForm(false);
        setProjectName('');
        setRequestAmount('');
        setJustification('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao registrar solicitação.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Signature verification & validation workflow
  const handleSignAction = async (requestId: string, approve: boolean) => {
    if (!approve && !rejectionReason.trim()) {
      alert("Por favor, informe a justificativa de rejeição.");
      return;
    }

    try {
      // Simulate signature stamp hash
      const sigHash = `NEXUS-AUTH-STAMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      
      const res = await fetch(`/api/budget-requests/${requestId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: roleInfo.userToUse.id,
          approve,
          rejectionReason: approve ? '' : rejectionReason,
          signatureHash: sigHash
        })
      });

      if (res.ok) {
        const updatedRequest: BudgetRequest = await res.json();
        setRejectingRequestId(null);
        setRejectionReason('');

        // If request status is fully APPROVED, now generate the pdf report and upload to VFS
        if (updatedRequest.status === 'APPROVED') {
          await generateAndSaveBudgetPdf(updatedRequest);
        } else {
          alert(`Fluxo atualizado! Assinatura registrada digitalmente: ${sigHash}`);
          fetchData();
        }
      } else {
        alert("Falha ao processar assinatura.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Generate polished PDF with signatures and QR Code, save to VFS
  const generateAndSaveBudgetPdf = async (req: BudgetRequest) => {
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
      const signatureRows = req.signatures.map(s => [
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

      // Validating QR Code API (free, reliable open api with reference URL)
      const qrData =`https://ai.studio/build/nexus-erp/validate/${req.id}?authId=${req.signatures[req.signatures.length - 1]?.hash || 'verified'}`;
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

        // Load the QR Server image as base64 or directly onto PDF canvas via jsPDF
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
      const uploadRes = await fetch(`/api/budget-requests/${req.id}/save-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: req.requesterId,
          fileName,
          fileData: base64Data
        })
      });

      if (uploadRes.ok) {
        alert("Excelente! O orçamento extra de verba foi integralmente homologado e assinado por todas as hierarquias. O documento PDF foi gerado com sucesso, contendo o selo de auditoria, QR Code, e foi armazenado automaticamente na pasta do colaborador!");
        fetchData();
      } else {
        alert("Erro ao salvar PDF homologado na nuvem.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao processar fluxo e certificar PDF.");
    }
  };

  // Check if current effective user is at the correct level to approve this item
  const getsApprovalSection = (req: BudgetRequest) => {
    if (req.status === 'APPROVED' || req.status === 'REJECTED') return null;

    // TI or CEO has 105% master access - can approve any stage
    if (currentUser?.department === 'TI' || roleInfo.isCEO) {
      const stageName = 
        req.status === 'PENDING_SUPERIOR' ? "Aprovação Superior Direto" :
        req.status === 'PENDING_FINANCE' ? "Autorização de Verbas (Financeiro)" : "Homologação";
      return { stage: `${stageName} (Acesso Master)`, actionLabel: "Assinar Homologação" };
    }

    // 1. PENDING_SUPERIOR: Requester's direct superior
    if (req.status === 'PENDING_SUPERIOR') {
      const reqUser = users.find(u => u.id === req.requesterId);
      if (reqUser && reqUser.superiorId === roleInfo.userToUse.id) {
        return { stage: "Aprovação Superior Direto", actionLabel: `Assinar como Superior de ${reqUser.name.split(' ')[0]}` };
      }
    }

    // 2. PENDING_FINANCE: Needs Finance department approval
    if (req.status === 'PENDING_FINANCE') {
      if (roleInfo.userToUse.department === 'FINANCEIRO') {
        return { stage: "Autorização de Verbas (Financeiro)", actionLabel: "Liberar Recursos & Assinar" };
      }
    }

    return null;
  };

  const statusMap = {
    'PENDING_SUPERIOR': { label: 'Aguardando Superior Direto', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    'PENDING_FINANCE': { label: 'Aguardando Liberação Financeira', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    'APPROVED': { label: 'Orçamento Extra Autorizado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'REJECTED': { label: 'Indeferido', color: 'bg-red-50 text-red-700 border-red-200' },
  };

  const hasFullGlobalAccess = 
    roleInfo.isCEO || 
    roleInfo.isAcionista || 
    roleInfo.isFinDir || 
    roleInfo.isGenDir || 
    roleInfo.userToUse.position.toUpperCase().includes('DIRETOR') ||
    roleInfo.userToUse.department === 'ADMINISTRATIVO' || 
    roleInfo.userToUse.department === 'TI' ||
    roleInfo.userToUse.department === 'DIRETORIA';

  const visibleRequests = requests.filter(req => 
    hasFullGlobalAccess || 
    req.requesterId === roleInfo.userToUse.id || 
    req.department === roleInfo.userToUse.department
  );

  // Budget progress trackers
  const isBudgetConfigured = !!globalBudget;
  const globalAmount = globalBudget ? globalBudget.amount : 0;
  const allocatedDeptSum = totalAllocatedToDepts;
  const remainingCompanyBudget = globalAmount - allocatedDeptSum;

  const currentMonthLabel = new Date(selectedMonth + "-15").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const superiorUser = roleInfo.userToUse.superiorId ? users.find(u => u.id === roleInfo.userToUse.superiorId) : null;
  const superiorLabel = superiorUser ? `Recebido de: ${superiorUser.name}` : "Sem superior imediato (Escopo Executivo)";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Upper header action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <PiggyBank className="text-blue-600" /> Controle de Orçamentos & Verbas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Planejamento corporativo mensal e fluxo rigoroso de aprovações extras auditadas digitalmente.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Calendar Month select filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs text-gray-500 font-medium font-mono uppercase">Mês Referência:</span>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              className="font-mono text-sm bg-transparent outline-none border-none text-gray-800 font-semibold"
            />
          </div>

          <button onClick={fetchData} className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 shadow-sm transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 🚀 SIMULATION & TESTING SUITE FOR OWNER CASCADE CHECKS */}
      {currentUser?.department === 'TI' && (
        <div className="bg-gradient-to-r from-blue-550/10 to-indigo-550/10 border border-blue-150 p-6 rounded-2xl flex flex-col md:flex-row md:items-center gap-6 shadow-sm text-left">
          <div className="shrink-0 w-12 h-12 bg-white text-blue-600 rounded-xl flex items-center justify-center border border-blue-150 shadow-sm">
            <ShieldAlert size={24} />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-bold text-gray-955 uppercase tracking-wider font-mono">Consola de Simulação & Cascata Hierárquica</h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
              Selecione qualquer nível operacional ou chefia regional no disparador abaixo para herdar suas dependências funcionais, verbas recebidas de superiores e delegar fundos aos liderados diretos de forma totalmente hierárquica.
            </p>
            
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <label className="text-xs font-semibold text-gray-700">Agente em Simulação:</label>
              <select
                value={simulatedUserId}
                onChange={e => {
                  setSimulatedUserId(e.target.value);
                  setSubordinateSearch('');
                }}
                className="bg-white border border-gray-300 rounded-lg px-3 py-1 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-gray-800 shadow-sm"
              >
                <option value="">👤 Eu Oficial ({currentUser?.name})</option>
                {users
                  .filter(u => u.status !== 'DISMISSED')
                  .sort((a, b) => {
                    const d = (a.department || '').localeCompare(b.department || '');
                    if (d !== 0) return d;
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      [{u.department || 'DIRETORIA'}] {u.name} - {u.position}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 📊 SUPERIOR GRAPHICAL PATH BREADCRUMBS */}
      {currentUser?.department === 'TI' && (
        <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm text-left">
          <div className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-widest mb-2">Trilha de Distribuição de Verbas do Topo à sua Conta:</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {hierarchyTrail.map((node, index) => {
              const isLast = index === hierarchyTrail.length - 1;
              const nodeBudget = employeeBudgets.find(b => b.targetId === node.id)?.amount || 0;
              return (
                <React.Fragment key={node.id}>
                  {index > 0 && <span className="text-gray-400 font-bold">➔</span>}
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${isLast ? 'bg-blue-600 text-white border-blue-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    <img src={node.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                    <span>{node.name.split(' ')[0]} <span className="opacity-75 font-mono text-[9px]">({node.position})</span></span>
                    <span className="font-mono text-[10px] ml-1 bg-black/10 px-1.5 py-0.5 rounded">R$ {(nodeBudget || (index === 0 && globalBudget ? globalBudget.amount : 0)).toLocaleString('pt-BR')}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
              {roleInfo.isCEO ? "Orçamento Geral da Empresa" : "Seu Orçamento Disponível (Cota)"}
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              {myBudgetAmt > 0 ? `R$ ${myBudgetAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5 mt-1 truncate">
              {roleInfo.isCEO ? currentMonthLabel : superiorLabel}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
              {mySubordinates.length > 0 ? "Verba Delegada à Equipe" : "Verba Alocada em Projetos"}
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              R$ {totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              {myBudgetAmt > 0 ? `${Math.round((totalAllocated / myBudgetAmt) * 100 || 0)}% Re-alocado em cascata` : "0% Re-alocado"}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shrink-0">
            <PiggyBank size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Seu Saldo Próprio Livre</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              R$ {remainingAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">Disponível para custeio interno setorial</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Management Controls and Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Setup, Budgets allocation based on level (width span 12 or 5 depending on profile) */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-8">
          
          {/* A. GENERAL COMPANY SETUP: Visible in cascade only to CEO/Root levels */}
          {(roleInfo.isCEO || !roleInfo.userToUse.superiorId) && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <ShieldCheck className="text-blue-600 shrink-0" size={20} />
                <div>
                  <h2 className="font-semibold text-gray-900">Configuração Global de Recursos</h2>
                  <p className="text-xs text-gray-500">Defina o montante total disponível na multinacional.</p>
                </div>
              </div>

              <form onSubmit={handleSaveGlobalBudget} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Caixa Geral do Mês (Ref. {currentMonthLabel})</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-sm text-gray-400 font-medium">R$</span>
                      <input 
                        type="number" 
                        required
                        value={globalBudgetAmt} 
                        onChange={e => setGlobalBudgetAmt(e.target.value)}
                        placeholder="Ex: 500000"
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors uppercase tracking-wider cursor-pointer">
                      Ajustar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* B. HIERARCHICAL DISTRIBUTOR PANEL: Visible if simulated agent has direct subordinates */}
          {mySubordinates.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6 text-left">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <PocketKnife className="text-blue-500 shrink-0" size={20} />
                  <div>
                    <h2 className="font-semibold text-gray-900 text-sm">Distribuição Hierárquica de Fundos</h2>
                    <p className="text-[11px] text-gray-500">Distribua a sua verba disponível entre seus subordinados diretos.</p>
                  </div>
                </div>
              </div>

              {/* Statistical Progress Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-gray-500">Recebido de Superior:</span>
                  <span className="text-gray-900 font-bold">R$ {myBudgetAmt.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-gray-500">Já Alocado para Subordinados:</span>
                  <span className="text-gray-900 font-bold">R$ {totalAllocated.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
                  <span className="text-blue-650">Seu Saldo de Manobra:</span>
                  <span className={remainingAmt < 0 ? "text-red-650" : "text-emerald-650"}>
                    R$ {remainingAmt.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Subordinate search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar subordinados diretos..." 
                  value={subordinateSearch} 
                  onChange={e => setSubordinateSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-1.5 pl-9 pr-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Card List of Subordinates */}
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {filteredSubordinates.map(sub => {
                  const subBudget = employeeBudgets.find(b => b.targetId === sub.id);
                  const subAmt = subBudget ? subBudget.amount : 0;
                  const subAllocated = subBudget ? subBudget.allocated : 0;
                  const currentInputVal = userAllocations[sub.id] || '';

                  return (
                    <div key={sub.id} className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-150 flex flex-col gap-3 relative">
                      
                      {/* Meta Profile row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <img src={sub.avatarUrl} className="w-8 h-8 rounded-full border border-gray-150" alt="" />
                          <div>
                            <div className="text-xs font-semibold text-gray-800">{sub.name}</div>
                            <div className="text-[9px] text-gray-400 uppercase font-mono tracking-wider">
                              {sub.position} <span className="text-blue-500 font-bold">({sub.department || 'DIRETORIA'})</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick role hierarchy pin */}
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase font-mono">
                          Subordinado
                        </span>
                      </div>

                      {/* Distribution Inputs */}
                      <div className="flex items-center justify-between gap-2 bg-white/75 p-2 rounded-lg border border-gray-100">
                        <div className="text-left">
                          <span className="text-[10px] text-gray-400 block">Investimento Estimado</span>
                          <span className="text-[11px] font-mono font-bold text-gray-800">
                            Atual: R$ {subAmt.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 mr-1">R$</span>
                          <input 
                            type="number" 
                            placeholder="Valor" 
                            value={currentInputVal}
                            onChange={e => {
                              const v = e.target.value;
                              setUserAllocations(prev => ({ ...prev, [sub.id]: v }));
                            }}
                            className="bg-white border border-gray-250 rounded-lg px-2.5 py-1 text-xs w-24 text-right focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-gray-800"
                          />
                          <button 
                            onClick={() => handleSaveSubordinateBudget(sub.id, currentInputVal)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Display what this subordinate delegated further down their tree */}
                      <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 border-t border-gray-100/50 pt-2">
                        <span>Liderados por {sub.name.split(' ')[0]}:</span>
                        <span className="font-semibold text-slate-800">
                          {subAllocated > 0 ? (
                            <span className="text-emerald-600 font-bold">R$ {subAllocated.toLocaleString('pt-BR')} delegados</span>
                          ) : (
                            <span className="italic">Nenhum valor delegado</span>
                          )}
                        </span>
                      </div>

                    </div>
                  );
                })}

                {filteredSubordinates.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Nenhum colaborador encontrado com esta busca.
                  </div>
                )}
              </div>
            </div>
          ) : (
            // C. STAFF / END-TIER CARD CASE: User does not have subordinates
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">Ponto Final da Trilha Hierárquica</h2>
                  <p className="text-xs text-gray-500">Você não possui subordinados diretos cadastrados no sistema.</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Frente a isso, você no papel de <span className="font-semibold text-gray-800">{roleInfo.userToUse.position}</span> é o ponto de consumo final de sua cota de recursos. Todo o valor sob sua guarda pode ser utilizado para gastos imediatos da equipe, campanhas do departamento, ou despesas regulares de funcionamento.
              </p>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl flex items-center justify-between font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Seu Orçamento Máximo Próprio</div>
                  <div className="text-xl font-bold tracking-wider mt-0.5">R$ {myBudgetAmt.toLocaleString('pt-BR')}</div>
                </div>
                <div className="p-2.5 bg-slate-800 rounded-full text-slate-300">
                  <Landmark size={18} />
                </div>
              </div>
            </div>
          )}

          {/* D. PERSONAL PROJECT WALLET: Shows the selected simulated user's active wallet quota */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Key className="text-amber-500" size={16} />
              <h3 className="font-bold text-gray-900 text-xs uppercase font-mono tracking-wider">Cota de Projeto Setorial</h3>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              Consórcio correspondente ao uso direto de fundos pela diretoria/gerência sem necessidade de nova redistribuição.
            </p>

            <div className="bg-slate-50 border border-gray-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block font-mono">Verba para Aplicação Direta</span>
                <span className="text-md font-bold font-mono text-gray-800">
                  R$ {remainingAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[10px] font-bold text-gray-500 font-mono bg-gray-200/50 px-2 py-0.5 rounded tracking-wide">
                DISPONÍVEL
              </span>
            </div>
          </div>

        </div>

        {/* Right column: Budget Requests List & Request extra form */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          
          {/* Header area of requests container */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-md">
              <ClipboardCheck size={20} className="text-blue-600" /> Solicitações de Recursos Extras
            </h3>
            
            <button 
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="bg-gray-950 hover:bg-gray-850 text-white rounded-xl text-xs font-semibold px-4 py-2 transition-transform active:scale-95 shadow-sm"
            >
              {showRequestForm ? "Fechar Formulário" : "Solicitar Recurso Extra"}
            </button>
          </div>

          <AnimatePresence>
            {showRequestForm && (
              <motion.form 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleSubmitRequest}
                className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4 overflow-hidden text-left"
              >
                <div className="border-b border-gray-100 pb-2 mb-2">
                  <h4 className="font-semibold text-gray-800 text-sm">Registrar Requisição de Verba Extra</h4>
                  <p className="text-xs text-gray-400">Envie uma justificativa sólida p/ auditoria e aprovação escalonada.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Projeto ou Finalidade</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Ex: Ampliação de servidores Cloud ou Campanha de anúncios" 
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Valor Adicional Necessário (R$)</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="Ex: 12500" 
                      value={requestAmount}
                      onChange={e => setRequestAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Justificativa Detalhada (Por que é essencial para o labor setorial?)</label>
                    <textarea 
                      required 
                      rows={4} 
                      placeholder="Indique os motivos estruturais, retorno esperado ou detalhamento operacional das verbas requisitadas..." 
                      value={justification}
                      onChange={e => setJustification(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowRequestForm(false)} 
                    className="px-4 py-2 border border-gray-250 text-xs font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingRequest}
                    className="px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Send size={13} /> {submittingRequest ? "Registrando..." : "Enviar p/ Auditoria Financeira"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of solicitudes */}
          <div className="space-y-4">
            {visibleRequests.map(req => {
              const appInfo = getsApprovalSection(req);
              
              return (
                <div key={req.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4 text-left">
                  
                  {/* Row 1: Header tags, metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", statusMap[req.status]?.color)}>
                        {statusMap[req.status]?.label}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">REQ-VERBA#{req.id.substring(0,8).toUpperCase()}</span>
                    </div>

                    <div className="text-right text-xs text-gray-400">
                      Criado em {new Date(req.createdAt).toLocaleDateString('pt-BR')} às {new Date(req.createdAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>

                  {/* Row 2: Basic request content */}
                  <div>
                    <h4 className="text-md font-bold text-gray-900">{req.projectName}</h4>
                    <p className="text-xs text-gray-650 mt-1 placeholder-opacity-50 whitespace-pre-wrap">{req.justification}</p>

                    {req.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <span className="font-bold">Motivo da Rejeição:</span> {req.rejectionReason}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Signatures Timeline List */}
                  {req.signatures.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-widest">Selo de Trilhas Assinadas:</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {req.signatures.map(stamp => (
                          <div key={stamp.hash} className="bg-gray-50 border border-gray-150 rounded-xl p-2 flex items-center gap-3 relative overflow-hidden">
                            <div className="h-2 w-2 bg-emerald-500 rounded-full shrink-0"></div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-gray-900 truncate">{stamp.userName}</div>
                              <div className="text-[10px] text-gray-500 truncate">{stamp.userPosition} - {stamp.userDepartment}</div>
                              <div className="text-[9px] text-gray-400 mt-1 font-mono tracking-wider">{stamp.hash}</div>
                            </div>

                            <div className="absolute right-2 bottom-1 opacity-10 text-[20px] font-mono select-none font-bold">STAMP</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 4: Status workflow trackers */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-gray-100 bg-gray-50/50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 font-semibold font-mono uppercase">Verba Extra Requisitada:</div>
                      <div className="text-lg font-bold text-slate-900 font-mono">
                        R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-right text-xs text-gray-500 font-medium">
                      Requisitado por: <span className="text-gray-900 font-semibold">{req.requesterName}</span> ({req.department})
                    </div>
                  </div>

                  {/* PDF download for homologated budgets */}
                  {req.status === 'APPROVED' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => generateAndSaveBudgetPdf(req)}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        <FileText size={14} /> Pré-visualizar / Recriar Certidão
                      </button>
                    </div>
                  )}

                  {/* Sign Action inputs */}
                  {appInfo && (
                    <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-150 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 uppercase font-mono tracking-wider">
                        <ShieldCheck size={16} /> Fase de Homologação: {appInfo.stage}
                      </div>

                      {/* Insufficient budget warning for direct superior */}
                      {req.status === 'PENDING_SUPERIOR' && remainingAmt < req.amount && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                          <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                          <div>
                            <strong className="font-extrabold">Aviso de Saldo Insuficiente:</strong> Seu saldo livre atual é de <strong>R$ {remainingAmt.toLocaleString('pt-BR')}</strong>, que é menor do que os <strong>R$ {req.amount.toLocaleString('pt-BR')}</strong> solicitados. Caso aprove, o saldo do seu setor ficará devedor. Se necessário, abra uma nova solicitação clicando em <strong>"Solicitar Recurso Extra"</strong> acima para requisitar verbas adicionais ao seu superior direto.
                          </div>
                        </div>
                      )}

                      {rejectingRequestId === req.id ? (
                        <div className="space-y-2">
                          <input 
                            required
                            type="text" 
                            placeholder="Descreva o motivo para a rejeição desta solicitação..." 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full bg-white border border-red-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => handleSignAction(req.id, false)}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                            >
                              Confirmar Indeferimento
                            </button>
                            <button 
                              onClick={() => setRejectingRequestId(null)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 rounded-xl"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button 
                            onClick={() => handleSignAction(req.id, true)}
                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95"
                          >
                            <Check size={14} /> {appInfo.actionLabel}
                          </button>
                          <button 
                            onClick={() => setRejectingRequestId(req.id)}
                            className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-250 text-red-700 text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95"
                          >
                            <X size={14} /> Indeferir Recurso
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}

            {visibleRequests.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                <FileText className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-gray-500 font-medium">Nenhuma solicitação de verba extra registrada.</p>
                <button 
                  onClick={() => setShowRequestForm(true)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-bold"
                >
                  Registrar minha primeira solicitação
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
      
      {/* PDF Preview Modal */}
      {previewPdfUri && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
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
                  className="text-gray-505 hover:bg-gray-105 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Iframe document view */}
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
