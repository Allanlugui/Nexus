import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sale } from '../types';
import { 
  DollarSign, 
  Target, 
  Plus, 
  Paperclip, 
  Check, 
  X, 
  Search, 
  Calendar, 
  FileCheck, 
  ShieldAlert, 
  TrendingUp, 
  User as UserIcon, 
  ShoppingBag, 
  FileText,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressImageIfNeeded } from '../lib/utils';

export function SalesView() {
  const { currentUser, users } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [registeringNewSale, setRegisteringNewSale] = useState(false);

  // Form State
  const [newSaleValue, setNewSaleValue] = useState('');
  const [newSaleClient, setNewSaleClient] = useState('');
  const [newSaleProduct, setNewSaleProduct] = useState('');
  const [newSaleDate, setNewSaleDate] = useState(new Date().toISOString().substring(0, 10));
  const [newSaleHasInvoice, setNewSaleHasInvoice] = useState(false);
  const [newSaleInvoiceNumber, setNewSaleInvoiceNumber] = useState('');
  const [newSaleDocument, setNewSaleDocument] = useState<{ name: string; data: string } | null>(null);

  // Filters State
  const [filterClient, setFilterClient] = useState('');
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Integration Logs State
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const target = 50000;

  const [activeTab, setActiveTab] = useState<'LEDGER' | 'DASHBOARD'>('LEDGER');

  const loadSales = async () => {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        setSales(await res.json());
      }
    } catch (err) {
      console.error("Error loading sales from server:", err);
    }
  };

  const loadIntegrationLogs = async () => {
    try {
      const res = await fetch('/api/system/integration-logs');
      if (res.ok) {
        setIntegrationLogs(await res.json());
      }
    } catch (err) {
      console.error("Error loading integration logs:", err);
    }
  };

  useEffect(() => {
    loadSales();
    loadIntegrationLogs();

    const interval = setInterval(() => {
      loadSales();
      loadIntegrationLogs();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSaleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageIfNeeded(file);
        setNewSaleDocument({
          name: file.name,
          data: compressedBase64
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao comprimir o comprovante de venda.");
      }
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSaleClient || !newSaleValue || !newSaleProduct) return;

    const body = {
      sellerId: currentUser?.id,
      value: Number(newSaleValue),
      client: newSaleClient,
      product: newSaleProduct,
      date: new Date(newSaleDate).getTime(),
      hasInvoice: newSaleHasInvoice,
      invoiceNumber: newSaleHasInvoice ? newSaleInvoiceNumber : '',
      documentData: newSaleDocument?.data || '',
      documentName: newSaleDocument?.name || ''
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        loadSales();
        setNewSaleValue('');
        setNewSaleClient('');
        setNewSaleProduct('');
        setNewSaleDate(new Date().toISOString().substring(0, 10));
        setNewSaleHasInvoice(false);
        setNewSaleInvoiceNumber('');
        setNewSaleDocument(null);
        setRegisteringNewSale(false);
        alert("Transação registrada com sucesso! Ela foi enviada para homologação do seu superior imediato.");
      } else {
        const data = await res.json();
        alert("Erro ao salvar transação: " + (data.error || ''));
      }
    } catch (err) {
      console.error(err);
      alert("Falha de conexão.");
    }
  };

  const handleApproveSale = async (saleId: string, approve: boolean) => {
    try {
      const endpoint = approve ? `/api/sales/${saleId}/approve` : `/api/sales/${saleId}/reject`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (res.ok) {
        alert(approve ? "Venda homologada e integrada nos históricos financeiros!" : "Venda rejeitada com sucesso.");
        loadSales();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao processar alteração.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm("Deseja realmente apagar esta transação?")) return;
    try {
      const res = await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
      if (res.ok) {
        setSales(prev => prev.filter(s => s.id !== saleId));
        setSelectedIds(prev => prev.filter(id => id !== saleId));
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao apagar.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Deseja realmente apagar as ${selectedIds.length} transações selecionadas?`)) return;
    try {
      const res = await fetch('/api/sales/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSales(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao apagar em massa.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSales.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Perform client filter calculations
  const filteredSales = sales.filter(s => {
    const matchesClient = s.client.toLowerCase().includes(filterClient.toLowerCase());
    const matchesInvoice = filterInvoice ? s.invoiceNumber?.includes(filterInvoice) || false : true;
    const matchesDate = filterDate ? format(new Date(s.date), 'yyyy-MM-dd') === filterDate : true;
    return matchesClient && matchesInvoice && matchesDate;
  });

  const activeUsers = users.filter(u => u.status !== 'DISMISSED');
  const subordinateIds = activeUsers.filter(u => u.superiorId === currentUser?.id).map(u => u.id);

  // Sales statistics KPI
  const approvedSales = filteredSales.filter(s => s.status === 'APPROVED');
  const totalSalesValue = approvedSales.reduce((acc, s) => acc + s.value, 0);
  const pendingSales = filteredSales.filter(s => s.status === 'PENDING_APPROVAL');
  const totalPendingValue = pendingSales.reduce((acc, s) => acc + s.value, 0);

  const progress = Math.min((totalSalesValue / target) * 100, 100);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Registro e Homologação de Vendas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lance novos contratos comerciais, confira o livro-caixa de comissões e acompanhe métricas de conversão.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('LEDGER')}
            className={`cursor-pointer px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'LEDGER' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Livro Caixa
          </button>
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`cursor-pointer px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'DASHBOARD' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Dashboard & Funil
          </button>
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md ml-2 transition-all transform hover:scale-105"
            >
              <Trash2 size={16} /> Apagar Selecionados ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={() => setRegisteringNewSale(!registeringNewSale)}
            className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs ml-2"
          >
            <Plus size={16} /> {registeringNewSale ? "Ocultar Lançamento" : "Registrar Venda"}
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Volume de Vendas Homologado</p>
          <h2 className="text-3xl font-black text-emerald-600 mt-1">R$ {totalSalesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <span className="text-[10px] text-gray-500">Valor líquido integrado ao caixa corporativo</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider font-sans">Meta do Setor Vendas</p>
          <h2 className="text-3xl font-black text-gray-950 mt-1">R$ {target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">Atingido {progress.toFixed(1)}% da régua comercial</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs text-left">
          <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">Vendas Sob Homologação</p>
          <h2 className="text-3xl font-black text-indigo-650 mt-1">R$ {totalPendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
          <span className="text-[10px] text-gray-500">{pendingSales.length} transações aguardando aprovação</span>
        </div>
      </div>

      {/* Registering Sales Form Drawer */}
      {registeringNewSale && (
        <form onSubmit={handleAddSale} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left space-y-4 animate-fade-in">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-3">
            <ShoppingBag size={18} className="text-emerald-600" /> Preencher Registro de Negociação Comercial
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Cliente / Razão Social</label>
              <input required placeholder="Ex: Brasil Distribuidora Ltda" value={newSaleClient} onChange={e => setNewSaleClient(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Produto / Serviço Vendido</label>
              <input required placeholder="Ex: Licença NexusERP Enterprise" value={newSaleProduct} onChange={e => setNewSaleProduct(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Valor do Contrato (R$)</label>
              <input required type="number" step="0.01" placeholder="Ex: 5000" value={newSaleValue} onChange={e => setNewSaleValue(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2 text-sm font-semibold bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Data da Venda</label>
              <input type="date" required value={newSaleDate} onChange={e => setNewSaleDate(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2 text-xs bg-white font-medium" />
            </div>
            <div className="flex flex-col justify-center">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Nota Fiscal Faturada?</label>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={newSaleHasInvoice} onChange={e => setNewSaleHasInvoice(e.target.checked)} className="rounded text-emerald-600 border-gray-300" />
                <span>Sim, possuo número faturado</span>
              </label>
            </div>
            {newSaleHasInvoice && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Número de Faturamento (NF-e)</label>
                <input required={newSaleHasInvoice} placeholder="Nº Nota Fiscal" value={newSaleInvoiceNumber} onChange={e => setNewSaleInvoiceNumber(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2 text-sm bg-white font-mono" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Contrato de Negociação / Comprovante Voucher (PDF ou Imagem)</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-dashed border-slate-300 p-4 rounded-xl">
              <Paperclip size={18} className="text-slate-400 shrink-0" />
              <input type="file" accept="image/*,application/pdf" onChange={handleSaleFileChange} className="text-xs text-slate-600 file:border-0 file:bg-gray-205 file:px-3 file:py-1.5 file:rounded-xl file:font-semibold" />
              {newSaleDocument && (
                <span className="text-[10px] bg-slate-200 font-bold px-2 py-1 rounded text-slate-700 truncate max-w-xs">Anexado: {newSaleDocument.name}</span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex gap-2">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 px-6 text-xs font-bold cursor-pointer transition-colors shadow-xs">Homologar Lançamento de Venda</button>
            <button type="button" onClick={() => setRegisteringNewSale(false)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl py-2.5 px-5 text-xs font-bold cursor-pointer">Cancelar</button>
          </div>
        </form>
      )}

      {activeTab === 'LEDGER' && (
        <>
          {/* Main filter interface */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs text-left space-y-4">
        <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-1"><Search size={14} /> Filtros do Ledger de Vendas</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Cliente / Razão Social</label>
            <input placeholder="Todos os clientes..." value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full border-gray-250 border rounded-lg p-2 text-xs bg-slate-50/50" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Número do Faturamento (NF-e)</label>
            <input placeholder="Filtre por NF-e..." value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)} className="w-full border-gray-250 border rounded-lg p-2 text-xs bg-slate-50/50" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Data Exata do Lançamento</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full border-gray-250 border rounded-lg p-2 text-xs bg-slate-50/50" />
          </div>
        </div>
      </div>

      {/* Ledger list and table records */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left space-y-4">
        <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 flex justify-between items-center text-sm uppercase tracking-wider">
          <span>Ledger Comercial de Negociações (Hub Integrado)</span>
          <span className="text-xs text-gray-500 font-sans italic font-normal">Mostrando {filteredSales.length} contratos</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse bg-transparent text-xs text-left text-gray-600">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 uppercase text-[9px] font-black tracking-widest bg-gray-50/40">
                <th className="py-3 px-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded text-emerald-600 border-gray-300 cursor-pointer" 
                    checked={filteredSales.length > 0 && selectedIds.length === filteredSales.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3 px-4">Cliente / Código</th>
                <th className="py-3 px-4">Produto / Serviço</th>
                <th className="py-3 px-4">Autoria (Vendedor)</th>
                <th className="py-3 px-4">Data Venda / Contrato</th>
                <th className="py-3 px-4 text-center">Fatura / NF-e / Status</th>
                <th className="py-3 px-4 text-center">Homologação / Etapa</th>
                <th className="py-3 px-4 text-right">Valor Líquido / Venda</th>
                <th className="py-3 px-4 text-right">
                  {selectedIds.length > 0 ? (
                    <button 
                      onClick={handleBulkDelete} 
                      className="text-rose-600 hover:text-rose-800 cursor-pointer p-1 flex items-center gap-1 ml-auto font-black"
                      title="Apagar selecionados"
                    >
                      <Trash2 size={14} /> <span className="text-[10px]">APAGAR</span>
                    </button>
                  ) : (
                    "Ações"
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.map((sale) => {
                const sellerObj = activeUsers.find(u => u.id === sale.sellerId);
                const isSubordinate = subordinateIds.includes(sale.sellerId);
                const canHomologate = currentUser?.isSystemAdmin || currentUser?.position === 'CEO' || isSubordinate;

                return (
                  <tr key={sale.id} className={`hover:bg-slate-50/40 transition-colors ${selectedIds.includes(sale.id) ? 'bg-emerald-50/30' : ''}`}>
                    <td className="py-3 px-4">
                      <input 
                        type="checkbox" 
                        className="rounded text-emerald-600 border-gray-300 cursor-pointer" 
                        checked={selectedIds.includes(sale.id)}
                        onChange={() => toggleSelectOne(sale.id)}
                      />
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      <div className="font-bold flex flex-wrap items-center gap-1.5">
                        {sale.clientCode && <span className="bg-emerald-50 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-black" title="Código de Integração">{sale.clientCode}</span>}
                        <span>{sale.client}</span>
                        {sale.operationStatus && (
                          <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full font-black ${
                            sale.operationStatus === 'vendida' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {sale.operationStatus === 'vendida' ? 'Vendida' : 'Não Vendida'}
                          </span>
                        )}
                      </div>
                      {sale.documentData && (
                        <a href={sale.documentData} download={sale.documentName || "anexo_venda.png"} className="text-[9px] text-teal-650 hover:underline flex items-center gap-1 font-bold mt-1">
                          <Paperclip size={10} /> Voucher Comprovante
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{sale.product}</td>
                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        {sale.sellerId === 'automatic' ? (
                          <div className="w-5 h-5 rounded-full border bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-800" title="Origem Automática Site">W</div>
                        ) : (
                          <img src={sellerObj?.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${sale.sellerName || 'vendedor'}`} className="w-5 h-5 rounded-full border bg-slate-100" alt="" />
                        )}
                        <span>{sale.sellerId === 'automatic' ? (sale.sellerName || 'Venda Automática') : (sellerObj?.name || sale.sellerName || 'Vendedor Nexus')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <div>Venda: {format(new Date(sale.date), "dd/MM/yyyy", { locale: ptBR })}</div>
                      {sale.contractDate && sale.contractDate !== sale.date && (
                        <div className="text-[10px] text-gray-400 font-normal">Contrato: {format(new Date(sale.contractDate), "dd/MM/yyyy", { locale: ptBR })}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {sale.hasInvoice ? (
                        <div className="space-y-1 inline-block text-center">
                          <span className="bg-blue-50 text-blue-700 p-1 px-2 rounded-lg font-black text-[9px] tracking-wide block">NF: {sale.invoiceNumber}</span>
                          {sale.invoiceStatus && <span className="text-[8px] text-sky-700 font-sans font-bold bg-sky-50 py-0.5 px-1 rounded block">{sale.invoiceStatus}</span>}
                        </div>
                      ) : (
                        <div className="space-y-1 inline-block text-center">
                          <span className="text-gray-400 italic text-[10px]">Sem NF / Interno</span>
                          {sale.invoiceStatus && <span className="text-[8px] text-slate-500 font-sans font-bold bg-slate-100 py-0.5 px-1 rounded block">{sale.invoiceStatus}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="space-y-1 inline-block text-center">
                        <span className={`p-1 px-2.5 rounded-xl font-bold tracking-wide text-[9px] uppercase block ${
                          sale.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          sale.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-yellow-50 text-yellow-700 border border-yellow-200 animate-pulse'
                        }`}>
                          {sale.status === 'APPROVED' ? 'Aprovada' :
                           sale.status === 'REJECTED' ? 'Recusada' : 'Sob Auditoria'}
                        </span>
                        {sale.homologationStage && (
                          <span className="text-[8px] text-indigo-850 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded block truncate max-w-[130px]" title={sale.homologationStage}>
                            Etapa: {sale.homologationStage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-gray-950 font-bold text-[13px]">
                        R$ {sale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      {sale.totalValue && sale.totalValue !== sale.value && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Bruto: R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        {sale.status === 'PENDING_APPROVAL' && canHomologate && (
                          <>
                            <button 
                              onClick={() => handleApproveSale(sale.id, true)} 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-md cursor-pointer"
                              title="Homologar venda faturada"
                            >
                              <Check size={12} />
                            </button>
                            <button 
                              onClick={() => handleApproveSale(sale.id, false)} 
                              className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md cursor-pointer"
                              title="Rejeitar venda"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleDeleteSale(sale.id)} 
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-md cursor-pointer ml-1 transition-colors"
                          title="Apagar transação"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 italic font-semibold">
                    <ShieldAlert size={36} className="mx-auto text-gray-300 mb-2" />
                    Nenhuma negociação comercial registrada de acordo com os filtros de busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" /> Funil de Conversão Comercial
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Leads (Total)</p>
                <h4 className="text-2xl font-black text-slate-800">{sales.length + 42}</h4>
                <p className="text-[10px] text-slate-400 mt-1">Estimado / Captação</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Negociações</p>
                <h4 className="text-2xl font-black text-blue-900">{sales.length}</h4>
                <p className="text-[10px] text-blue-500 mt-1">({Math.round((sales.length / (sales.length + 42)) * 100)}% conversão)</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Em Auditoria</p>
                <h4 className="text-2xl font-black text-yellow-900">{sales.filter(s => s.status === 'PENDING_APPROVAL').length}</h4>
                <p className="text-[10px] text-yellow-500 mt-1">Aguardando Homologação</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Fechamento</p>
                <h4 className="text-2xl font-black text-emerald-900">{sales.filter(s => s.status === 'APPROVED').length}</h4>
                <p className="text-[10px] text-emerald-500 mt-1">({Math.round((sales.filter(s => s.status === 'APPROVED').length / sales.length) * 100)}% das negociações)</p>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-bold text-gray-800 mb-3">Histórico de Performance por Cliente (Top 5)</h4>
              <div className="space-y-2">
                {Array.from(new Set(sales.map(s => s.client))).slice(0,5).map((client, idx) => {
                  const clientSales = sales.filter(s => s.client === client && s.status === 'APPROVED');
                  const clientTotal = clientSales.reduce((acc, s) => acc + s.value, 0);
                  if (clientTotal === 0) return null;
                  return (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-sm font-semibold text-slate-700">{client}</span>
                      <span className="text-sm font-black text-emerald-700">R$ {clientTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connected Integration Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Painel de Sincronizações e Integrações Ativas
          </h3>
          <button 
            type="button" 
            onClick={() => { setShowIntegrations(!showIntegrations); loadIntegrationLogs(); }} 
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            {showIntegrations ? "Ocultar Monitor de Integração" : "Visualizar Monitor de Integração"}
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Esta plataforma está integrada bidirecionalmente com o <strong>AdminHub Enterprise</strong> para a base de Recursos Humanos (cadastros de colaboradores) e escuta passivamente o fluxo de vendas originado da <strong>Loja Dicas by Ale</strong>.
        </p>

        {showIntegrations && (
          <div className="space-y-4 animate-fade-in pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Trilha de Sincronismo Recente (Nexus API Gateway)</h4>
            <div className="overflow-x-auto max-h-85 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 font-extrabold text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-150">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Sentido</th>
                    <th className="p-3">Tipo de Fluxo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Detalhe do Evento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {integrationLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-white transition-colors">
                      <td className="p-3 text-[10px] text-gray-400 font-mono">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          log.direction === 'INBOUND' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}>
                          {log.direction === 'INBOUND' ? '← Entrada (Recebida)' : '→ Saída (Disparada)'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {log.type === 'SALES_RECEPTION' ? 'Vendas (Loja Dicas)' : log.type === 'HR_RECEPTION' ? 'Integração RH (Recepção)' : 'Integração RH (Envio)'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {log.status === 'SUCCESS' ? 'Sucesso' : 'Falha'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium font-sans">
                        {log.detail}
                      </td>
                    </tr>
                  ))}
                  {integrationLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic font-sans text-xs">
                        Nenhuma comunicação registrada no barramento de integração até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
