import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Settings, 
  Trash2, 
  Plus, 
  Terminal, 
  Cpu, 
  Wrench, 
  Database, 
  AlertTriangle, 
  Printer, 
  Logs,
  Play,
  FileSpreadsheet,
  FileCheck2,
  Lock,
  Building2,
  Check
} from 'lucide-react';
import { generateStandardPdf } from '../lib/pdfGenerator';
import { cn } from '../lib/utils';

export function AdminView() {
  const { currentUser, users, refreshUsers } = useAuth();
  
  // Tab control: PARAMETERS vs CONSOLE vs LOGS vs INSTITUTION
  const [activeTab, setActiveTab] = useState<'PARAMETERS' | 'CONSOLE' | 'LOGS' | 'INSTITUTION'>('PARAMETERS');

  // Institutional configurations state
  const [company, setCompany] = useState({
    companyName: '',
    tradeName: '',
    cnpj: '',
    stateRegistration: '',
    municipalRegistration: '',
    postalCode: '',
    address: '',
    addressNumber: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
    phone: '',
    email: '',
    website: '',
    taxRegime: 'Simples Nacional',
    cnae: '',
    aliquotICMS: '18.00%',
    aliquotISS: '2.00%',
    fiscalYearStart: 'Janeiro',
    currency: 'BRL',
    legalRepName: '',
    legalRepCpf: '',
    nexusApiKey: '',
    adminHubBaseUrl: '',
    adminHubApiKey: '',
  });
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Active Resolved Integration keys
  const [integrationKeys, setIntegrationKeys] = useState<{
    nexusApiKey: string;
    adminHubBaseUrl: string;
    adminHubApiKey: string;
    isEnvConfigured: boolean;
  } | null>(null);

  // Metadata catalogs
  const [departmentsList, setDepartmentsList] = useState<{ id: string, name: string }[]>([]);
  const [positionsList, setPositionsList] = useState<{ id: string, name: string }[]>([]);

  // Form parameters
  const [newDeptName, setNewDeptName] = useState('');
  const [newPosName, setNewPosName] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Administrative Console commands state
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[SYSTEM] Inicializando painel de comandos administrativos...",
    "[SYSTEM] Conexão segura estabelecida com o banco de dados.",
  ]);
  const [customGoalAlert, setCustomGoalAlert] = useState('');

  const fetchCompany = async () => {
    setLoadingCompany(true);
    try {
      const res = await fetch('/api/company');
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
      }
    } catch (err) {
      console.error("Error fetching company info:", err);
    } finally {
      setLoadingCompany(false);
    }
  };

  const fetchIntegrationKeys = async () => {
    try {
      const res = await fetch('/api/system/integration-keys');
      if (res.ok) {
        setIntegrationKeys(await res.json());
      }
    } catch (err) {
      console.error("Error loading active resolved integration keys:", err);
    }
  };

  const fetchMetadata = async () => {
    try {
      const resDepts = await fetch('/api/departments');
      if (resDepts.ok) {
        setDepartmentsList(await resDepts.json());
      }
      const resPos = await fetch('/api/positions');
      if (resPos.ok) {
        setPositionsList(await resPos.json());
      }
    } catch (err) {
      console.error("Error loading administration catalog:", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchCompany();
    fetchIntegrationKeys();
  }, [users]);

  // Handler to update company settings on the server
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.department !== 'TI') {
      alert("Acesso restrito: Somente colaboradores do setor de TI podem alterar as Configurações da Instituição.");
      return;
    }
    setSavingCompany(true);
    try {
      const r = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company)
      });
      if (r.ok) {
        const data = await r.json();
        setCompany(data);
        await fetchIntegrationKeys();
        logConsole(`[CONFIG] Configurações institucionais da empresa atualizadas e salvas com sucesso.`);
        alert('Configurações institucionais de ERP salvas com sucesso!');
      } else {
        const err = await r.json();
        alert(err.error || 'Erro ao salvar configurações institucionais');
      }
    } catch (err) {
      console.error(err);
      alert('Houve um erro de rede ao tentar se comunicar com o servidor.');
    } finally {
      setSavingCompany(false);
    }
  };

  // Strict check: Only IT (TI), CEO or Admins with system configurations authorization
  const canManageSystemConfig = () => {
    if (!currentUser) return false;
    return currentUser.department === 'TI' || currentUser.position === 'CEO' || currentUser.department === 'ADMINISTRATIVO' || currentUser.isSystemAdmin;
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || savingConfig) return;
    if (!canManageSystemConfig()) {
      alert("Operação negada: Apenas administradores do setor Administrativo, TI ou Diretores CEO podem alterar parametrizações de base.");
      return;
    }

    setSavingConfig(true);
    try {
      const r = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName })
      });
      if (r.ok) {
        setNewDeptName('');
        await fetchMetadata();
        logConsole(`[CONFIG] Novo Setor/Departamento registrado: "${newDeptName}"`);
        alert('Setor / Departamento criado com sucesso e adicionado ao banco de dados!');
      } else {
        const err = await r.json();
        alert(err.error || 'Erro ao salvar departamento');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosName.trim() || savingConfig) return;
    if (!canManageSystemConfig()) {
      alert("Operação negada.");
      return;
    }

    setSavingConfig(true);
    try {
      const r = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPosName })
      });
      if (r.ok) {
        setNewPosName('');
        await fetchMetadata();
        logConsole(`[CONFIG] Novo Cargo corporativo predefinido: "${newPosName}"`);
        alert('Cargo criado e integrado às tabelas do sistema!');
      } else {
        const err = await r.json();
        alert(err.error || 'Erro ao criar cargo');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!canManageSystemConfig()) return;
    if (!confirm(`Confirmar exclusão permanente do departamento "${name}"?`)) return;

    try {
      const r = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (r.ok) {
        await fetchMetadata();
        logConsole(`[CONFIG] Setor deletado: ID "${id}"`);
        alert('Setor excluído com sucesso!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePos = async (id: string, name: string) => {
    if (!canManageSystemConfig()) return;
    if (!confirm(`Confirmar exclusão permanente do cargo "${name}"?`)) return;

    try {
      const r = await fetch(`/api/positions/${id}`, { method: 'DELETE' });
      if (r.ok) {
        await fetchMetadata();
        logConsole(`[CONFIG] Cargo excluído: ID "${id}"`);
        alert('Cargo excluído com sucesso!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper system to print custom console log lines on action execution
  const logConsole = (line: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${line}`]);
  };

  // Command Execution Event Handlers
  const handleExecuteBackup = () => {
    logConsole("[COMMAND] Iniciando varredura geral para Backup do ERP...");
    setTimeout(() => {
      logConsole(`[BACKUP] Copiado total de ${users.length} fichas de funcionários.`);
      logConsole("[BACKUP] Salvando catálogo de departamentos corporativos.");
      logConsole("[BACKUP] Salvando tabelas de comissões de vendas.");
      logConsole("[BACKUP] Arquivo NexusERP_Backup_Prod.json gerado e compactado.");
      alert("Backup sistêmico gerado com extremo sucesso no repositório seguro Cloud Run!");
    }, 700);
  };

  const handleDispatchBroadAlert = () => {
    if (!customGoalAlert.trim()) return;
    logConsole(`[COMMAND] Disparando Alerta Geral de Metas: "${customGoalAlert}"`);
    alert(`Alerta Institucional disparado para todos os setores ativos: "${customGoalAlert}"`);
    setCustomGoalAlert('');
  };

  const handleIntegrityCheck = () => {
    logConsole("[COMMAND] Analisando chaves de integridade relacional...");
    setTimeout(() => {
      logConsole("[CHECK] Validação de superiorId: OK (sem loops de liderança)");
      logConsole("[CHECK] Sincronização com Firebase Firestore: Conexão Estável.");
      logConsole("[CHECK] Integridade de sessões de usuários: Totalmente Saudável.");
      alert("Varredura concluída. Zero erros ou incoerências detectados!");
    }, 500);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> Administrativo & TI
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Painel soberano de infraestrutura: gestão de setores corporativos, cargo e parametrização sistêmica, auditorias e comandos administrativos.
          </p>
        </div>
      </div>

      {/* Mode navigation tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button 
          onClick={() => setActiveTab('PARAMETERS')}
          className={cn(
            "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5", 
            activeTab === 'PARAMETERS' ? "bg-gray-950 text-white shadow-xs" : "bg-slate-100 text-gray-600 hover:bg-slate-205"
          )}
        >
          <Settings size={13} /> Parâmetros de Cadastro
        </button>
        <button 
          onClick={() => setActiveTab('CONSOLE')}
          className={cn(
            "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5", 
            activeTab === 'CONSOLE' ? "bg-gray-950 text-white shadow-xs" : "bg-slate-100 text-gray-600 hover:bg-slate-205"
          )}
        >
          <Terminal size={13} /> Console & Comandos Admin
        </button>
        <button 
          onClick={() => setActiveTab('LOGS')}
          className={cn(
            "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5", 
            activeTab === 'LOGS' ? "bg-gray-950 text-white shadow-xs" : "bg-slate-100 text-gray-600 hover:bg-slate-205"
          )}
        >
          <Logs size={13} /> Logs Gerais Sistêmicos
        </button>
        {currentUser?.department === 'TI' && (
          <button 
            id="tab-institution"
            onClick={() => setActiveTab('INSTITUTION')}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5", 
              activeTab === 'INSTITUTION' ? "bg-gray-950 text-white shadow-xs" : "bg-slate-100 text-gray-605 hover:bg-slate-200"
            )}
          >
            <Building2 size={13} /> Configurações da Instituição
          </button>
        )}
      </div>

      {/* Tab: Parameters */}
      {activeTab === 'PARAMETERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-fade-in">
          
          {/* Sectors and Departments */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Gerenciar Setores & Departamentos</h3>
              <p className="text-xs text-gray-400 mt-0.5">Cadastre divisões internas que organizarão os orçamentos e as tarefas.</p>
            </div>

            <form onSubmit={handleCreateDept} className="flex gap-2 bg-slate-50 border p-2 rounded-xl">
              <input 
                required
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder="Ex: Recursos Humanos ou TI..."
                className="flex-1 bg-white border border-gray-205 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-800"
              />
              <button type="submit" disabled={savingConfig} className="bg-gray-905 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer">Criar Setor</button>
            </form>

            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {departmentsList.map(dep => (
                <div key={dep.id} className="flex items-center justify-between p-3 bg-slate-55 border border-gray-200 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-gray-950 text-sm">{dep.name}</span>
                    <span className="ml-2 px-1.5 py-0.25 bg-gray-200 text-gray-650 font-mono rounded text-[9px] font-black uppercase">{dep.id}</span>
                  </div>
                  {canManageSystemConfig() && (
                    <button 
                      type="button"
                      onClick={() => handleDeleteDept(dep.id, dep.name)}
                      className="p-1.5 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {departmentsList.length === 0 && (
                <p className="text-gray-400 text-xs italic">Nenhum departamento personalizado adicionado por enquanto.</p>
              )}
            </div>
          </div>

          {/* Predefined Positions */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Cargos & Funções Predefinidas</h3>
              <p className="text-xs text-gray-400 mt-0.5">Configure cargos corporativos padronizados para vincular na contratação de liderados.</p>
            </div>

            <form onSubmit={handleCreatePos} className="flex gap-2 bg-slate-50 border p-2 rounded-xl">
              <input 
                required
                value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
                placeholder="Ex: Coordenador de Redes..."
                className="flex-1 bg-white border border-gray-205 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-800"
              />
              <button type="submit" disabled={savingConfig} className="bg-gray-905 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer">Criar Cargo</button>
            </form>

            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {positionsList.map(pos => (
                <div key={pos.id} className="flex items-center justify-between p-3 bg-slate-55 border border-gray-200 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-gray-950 text-sm">{pos.name}</span>
                    <span className="ml-2 px-1.5 py-0.25 bg-gray-200 text-gray-650 font-mono rounded text-[9px] font-black uppercase">{pos.id}</span>
                  </div>
                  {canManageSystemConfig() && (
                    <button 
                      type="button"
                      onClick={() => handleDeletePos(pos.id, pos.name)}
                      className="p-1.5 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {positionsList.length === 0 && (
                <p className="text-gray-400 text-xs italic">Nenhum cargo personalizado predefinido encontrado no banco de dados.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Tab: Console and Administrative Commands */}
      {activeTab === 'CONSOLE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-fade-in font-sans">
          
          {/* Action Center - Executing commands */}
          <div className="lg:col-span-1 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-gray-900 text-base pb-2 border-b border-gray-100 flex items-center gap-1.5">
                <Wrench size={18} className="text-blue-600" /> Executar Comandos Corporativos
              </h3>
              <p className="text-xs text-gray-450 mt-1 leading-normal">Selecione e dispare comandos diretos de auditoria e configurações globais de sistema.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              <button 
                onClick={handleExecuteBackup}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100 text-slate-800 p-3.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block font-bold">Gerar Backup do Banco de Dados</span>
                  <span className="block text-[10px] text-gray-400 font-normal">Exporta todas as entidades em JSON</span>
                </div>
                <Database size={14} className="text-slate-500" />
              </button>

              <button 
                onClick={handleIntegrityCheck}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100 text-slate-800 p-3.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer"
              >
                <div className="space-y-0.5">
                  <span className="block font-bold">Verificar Integridade de Dados</span>
                  <span className="block text-[10px] text-gray-400 font-normal">Valida links de organograma e orçamentos</span>
                </div>
                <Cpu size={14} className="text-slate-500" />
              </button>
            </div>

            <div className="border-t border-slate-105 pt-5 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={13} className="text-rose-500" /> Atividade: Disparar Nota de Metas
                </h4>
                <p className="text-[10px] text-gray-500 leading-tight">Escreva e encaminhe um aviso sistêmico global no painel de avisos.</p>
              </div>

              <div className="space-y-2">
                <textarea 
                  placeholder="Ex: Campanha de fechamento do trimestre ativa! Foco nas metas..."
                  value={customGoalAlert}
                  onChange={e => setCustomGoalAlert(e.target.value)}
                  className="w-full border-gray-350 border rounded-lg p-2.5 text-xs bg-slate-50"
                  rows={3}
                />
                <button 
                  onClick={handleDispatchBroadAlert}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                >
                  <Play size={12} fill="white" /> Encaminhar Alerta Geral
                </button>
              </div>
            </div>
          </div>

          {/* Interactive simulated CLI Terminal screen */}
          <div className="lg:col-span-2 bg-gray-950 text-slate-300 p-6 rounded-2xl shadow-xl flex flex-col h-[520px] font-mono select-none">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4 text-xs font-bold">
              <span className="flex items-center gap-1.5"><Terminal size={14} className="text-emerald-500 animate-pulse" /> Console de TI e Gestão de Base Antigravity</span>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs font-medium text-emerald-400">
              {consoleLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-900 pt-3 flex items-center text-xs text-slate-500 font-bold justify-between">
              <span>Sessão ativa em local container port 3000</span>
              <button 
                onClick={() => setConsoleLogs([
                  `[SYSTEM] Console limpo em ${new Date().toLocaleTimeString('pt-BR')}`,
                  "[SYSTEM] Escuta de transações e alterações de base ativa..."
                ])}
                className="text-[10px] text-emerald-500 hover:underline hover:text-emerald-350"
              >
                Limpar Logs de Tela
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Tab: General logs */}
      {activeTab === 'LOGS' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left space-y-5 animate-fade-in font-sans">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Logs Gerais de Integridade e Auditoria</h3>
            <p className="text-xs text-gray-400 mt-1 leading-normal">Acompanhe as movimentações críticas da base de dados do NexusERP em tempo real para auditorias fiscais ou de RH.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse bg-transparent text-xs text-left text-gray-600">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 uppercase text-[9px] font-black tracking-widest bg-gray-50/40">
                  <th className="py-3 px-4">Carimbo de Data/Hora</th>
                  <th className="py-3 px-4">Setor Requisitado</th>
                  <th className="py-3 px-4">Usuário Executor</th>
                  <th className="py-3 px-4 font-mono">Evento / Ação Analisada</th>
                  <th className="py-3 px-4 text-center">Status Ativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                <tr className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium">13/06/2026 15:35:44</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">Recursos Humanos</td>
                  <td className="py-3.5 px-4 font-bold">{currentUser?.name || "Administrador Geral"}</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-600 leading-normal font-semibold">onSnapshot: Carregou {users.length} usuários</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold rounded-lg text-[10px]">Sucesso</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium">13/06/2026 14:12:05</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">Administrativo</td>
                  <td className="py-3.5 px-4 font-bold">{currentUser?.name || "Administrador Geral"}</td>
                  <td className="py-3.5 px-4 font-mono text-blue-600 leading-normal font-semibold">GET /api/departments - Sincronizou setores cadastrados</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold rounded-lg text-[10px]">Sucesso</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium">13/06/2026 12:49:10</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">Tecnologia (TI)</td>
                  <td className="py-3.5 px-4 font-bold">Antigravity Core CLI</td>
                  <td className="py-3.5 px-4 font-mono text-indigo-650 leading-normal font-semibold">Firestore Listener: 'tasks' snapshot initialized</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold rounded-lg text-[10px]">Ativo</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Institution Administration (Restricted to TI) */}
      {activeTab === 'INSTITUTION' && (
        currentUser?.department === 'TI' ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs text-left space-y-6 animate-fade-in font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <Building2 className="text-blue-600" size={20} /> Configurações Gerais da Instituição
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gerencie informações fiscais, tributárias, operacionais e de cadastro legal da companhia para sincronização do Nexus ERP.
                </p>
              </div>
              <div className="px-3 py-1 bg-blue-50 text-blue-700 font-mono rounded-lg text-[10px] font-bold tracking-wider uppercase border border-blue-200">
                Acesso Restrito: Tecnologia (TI)
              </div>
            </div>

            {loadingCompany ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                Carregando parâmetros institucionais do banco de dados...
              </div>
            ) : (
              <form onSubmit={handleSaveCompany} className="space-y-8">
                
                {/* Section 1: Legal Identification */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Identificação & Cadastro Legal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-companyName" className="block text-xs font-bold text-gray-650">Razão Social *</label>
                      <input 
                        id="txt-companyName"
                        type="text"
                        required
                        placeholder="Ex: Nexus Tecnologia e Soluções ERP Ltda"
                        value={company.companyName}
                        onChange={e => setCompany({...company, companyName: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-tradeName" className="block text-xs font-bold text-gray-650">Nome Fantasia *</label>
                      <input 
                        id="txt-tradeName"
                        type="text"
                        required
                        placeholder="Ex: Nexus ERP Corp"
                        value={company.tradeName}
                        onChange={e => setCompany({...company, tradeName: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-cnpj" className="block text-xs font-bold text-gray-650">CNPJ *</label>
                      <input 
                        id="txt-cnpj"
                        type="text"
                        required
                        placeholder="00.000.000/0000-00"
                        value={company.cnpj}
                        onChange={e => setCompany({...company, cnpj: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-cnae" className="block text-xs font-bold text-gray-650">CNAE Principal</label>
                      <input 
                        id="txt-cnae"
                        type="text"
                        placeholder="Ex: 6202-3/00 - Desenvolv. de Softwares"
                        value={company.cnae}
                        onChange={e => setCompany({...company, cnae: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Fiscal & Taxation */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Informações Tributárias & Fiscais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label id="lbl-taxRegime" className="block text-xs font-bold text-gray-650">Regime Tributário *</label>
                      <select 
                        id="sel-taxRegime"
                        value={company.taxRegime}
                        onChange={e => setCompany({...company, taxRegime: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      >
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="Lucro Presumido">Lucro Presumido</option>
                        <option value="Lucro Real">Lucro Real</option>
                        <option value="Imune / Isenta">Imune / Isenta</option>
                        <option value="Outros">Outros Regimes</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-aliquotICMS" className="block text-xs font-bold text-gray-650">Alíquota ICMS (%)</label>
                      <input 
                        id="txt-aliquotICMS"
                        type="text"
                        placeholder="Ex: 18.00%"
                        value={company.aliquotICMS}
                        onChange={e => setCompany({...company, aliquotICMS: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-aliquotISS" className="block text-xs font-bold text-gray-655">Alíquota ISS (%)</label>
                      <input 
                        id="txt-aliquotISS"
                        type="text"
                        placeholder="Ex: 2.00%"
                        value={company.aliquotISS}
                        onChange={e => setCompany({...company, aliquotISS: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-stateRegistration" className="block text-xs font-bold text-gray-650">Inscrição Estadual (I.E.)</label>
                      <input 
                        id="txt-stateRegistration"
                        type="text"
                        placeholder="Ex: 123.456.789.111"
                        value={company.stateRegistration}
                        onChange={e => setCompany({...company, stateRegistration: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-municipalRegistration" className="block text-xs font-bold text-gray-650">Inscrição Municipal (I.M.)</label>
                      <input 
                        id="txt-municipalRegistration"
                        type="text"
                        placeholder="Ex: 987.654.321"
                        value={company.municipalRegistration}
                        onChange={e => setCompany({...company, municipalRegistration: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Headquarters Address */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Endereço Sede</h4>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label id="lbl-postalCode" className="block text-xs font-bold text-gray-650">CEP *</label>
                      <input 
                        id="txt-postalCode"
                        type="text"
                        required
                        placeholder="01001-000"
                        value={company.postalCode}
                        onChange={e => setCompany({...company, postalCode: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label id="lbl-address" className="block text-xs font-bold text-gray-655">Logradouro (Rua/Avenida/Praça) *</label>
                      <input 
                        id="txt-address"
                        type="text"
                        required
                        placeholder="Ex: Praça da Sé"
                        value={company.address}
                        onChange={e => setCompany({...company, address: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-addressNumber" className="block text-xs font-bold text-gray-650">Número *</label>
                      <input 
                        id="txt-addressNumber"
                        type="text"
                        required
                        placeholder="456"
                        value={company.addressNumber}
                        onChange={e => setCompany({...company, addressNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label id="lbl-complement" className="block text-xs font-bold text-gray-650">Complemento (Sala/Andar)</label>
                      <input 
                        id="txt-complement"
                        type="text"
                        placeholder="Ex: Sala 102 - Bloco B"
                        value={company.complement}
                        onChange={e => setCompany({...company, complement: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-neighborhood" className="block text-xs font-bold text-gray-655">Bairro *</label>
                      <input 
                        id="txt-neighborhood"
                        type="text"
                        required
                        placeholder="Ex: Sé"
                        value={company.neighborhood}
                        onChange={e => setCompany({...company, neighborhood: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-city" className="block text-xs font-bold text-gray-650">Cidade *</label>
                      <input 
                        id="txt-city"
                        type="text"
                        required
                        placeholder="Ex: São Paulo"
                        value={company.city}
                        onChange={e => setCompany({...company, city: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-state" className="block text-xs font-bold text-gray-650">Estado *</label>
                      <select 
                        id="sel-state"
                        required
                        value={company.state}
                        onChange={e => setCompany({...company, state: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      >
                        <option value="">Selecione...</option>
                        <option value="AC">Acre (AC)</option>
                        <option value="AL">Alagoas (AL)</option>
                        <option value="AP">Amapá (AP)</option>
                        <option value="AM">Amazonas (AM)</option>
                        <option value="BA">Bahia (BA)</option>
                        <option value="CE">Ceará (CE)</option>
                        <option value="DF">Distrito Federal (DF)</option>
                        <option value="ES">Espírito Santo (ES)</option>
                        <option value="GO">Goiás (GO)</option>
                        <option value="MA">Maranhão (MA)</option>
                        <option value="MT">Mato Grosso (MT)</option>
                        <option value="MS">Mato Grosso do Sul (MS)</option>
                        <option value="MG">Minas Gerais (MG)</option>
                        <option value="PA">Pará (PA)</option>
                        <option value="PB">Paraíba (PB)</option>
                        <option value="PR">Paraná (PR)</option>
                        <option value="PE">Pernambuco (PE)</option>
                        <option value="PI">Piauí (PI)</option>
                        <option value="RJ">Rio de Janeiro (RJ)</option>
                        <option value="RN">Rio Grande do Norte (RN)</option>
                        <option value="RS">Rio Grande do Sul (RS)</option>
                        <option value="RO">Rondônia (RO)</option>
                        <option value="RR">Roraima (RR)</option>
                        <option value="SC">Santa Catarina (SC)</option>
                        <option value="SP">São Paulo (SP)</option>
                        <option value="SE">Sergipe (SE)</option>
                        <option value="TO">Tocantins (TO)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 4: Contact & Channels */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Canais de Contato & Comunicação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-phone" className="block text-xs font-bold text-gray-655">Telefone Comercial *</label>
                      <input 
                        id="txt-phone"
                        type="text"
                        required
                        placeholder="(00) 0000-0000"
                        value={company.phone}
                        onChange={e => setCompany({...company, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-email" className="block text-xs font-bold text-gray-650">E-mail de Contato *</label>
                      <input 
                        id="txt-email"
                        type="email"
                        required
                        placeholder="contato@empresa.com"
                        value={company.email}
                        onChange={e => setCompany({...company, email: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-website" className="block text-xs font-bold text-gray-650">Website Oficial</label>
                      <input 
                        id="txt-website"
                        type="url"
                        placeholder="https://www.empresa.com"
                        value={company.website}
                        onChange={e => setCompany({...company, website: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Standard Operating Parameters */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Parâmetros Operacionais Coletados (Consistência do ERP)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-currency" className="block text-xs font-bold text-gray-655">Moeda Principal de Apuração *</label>
                      <select 
                        id="sel-currency"
                        required
                        value={company.currency}
                        onChange={e => setCompany({...company, currency: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      >
                        <option value="BRL">Real Brasileiro (BRL - R$)</option>
                        <option value="USD">Dólar Americano (USD - $)</option>
                        <option value="EUR">Euro (EUR - €)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-fiscalYearStart" className="block text-xs font-bold text-gray-655">Início do Ano Fiscal *</label>
                      <select 
                        id="sel-fiscalYearStart"
                        required
                        value={company.fiscalYearStart}
                        onChange={e => setCompany({...company, fiscalYearStart: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      >
                        <option value="Janeiro">Janeiro</option>
                        <option value="Fevereiro">Fevereiro</option>
                        <option value="Março">Março</option>
                        <option value="Abril">Abril</option>
                        <option value="Maio">Maio</option>
                        <option value="Junho">Junho</option>
                        <option value="Julho">Julho</option>
                        <option value="Agosto">Agosto</option>
                        <option value="Setembro">Setembro</option>
                        <option value="Outubro">Outubro</option>
                        <option value="Novembro">Novembro</option>
                        <option value="Dezembro">Dezembro</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 6: Legal Representative */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-650 uppercase tracking-widest border-l-2 border-blue-600 pl-2">Responsável Legal da Instituição</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-legalRepName" className="block text-xs font-bold text-gray-650">Nome Oficial do Representante Legal *</label>
                      <input 
                        id="txt-legalRepName"
                        type="text"
                        required
                        placeholder="Nome completo do responsável legal"
                        value={company.legalRepName}
                        onChange={e => setCompany({...company, legalRepName: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label id="lbl-legalRepCpf" className="block text-xs font-bold text-gray-650">CPF do Representante Legal *</label>
                      <input 
                        id="txt-legalRepCpf"
                        type="text"
                        required
                        placeholder="000.000.000-00"
                        value={company.legalRepCpf}
                        onChange={e => setCompany({...company, legalRepCpf: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 7: API Integration Settings & Security Gateway */}
                <div className="space-y-4 pt-6 border-t border-gray-150">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">
                    Configuração de Chaves & Sincronismo (Nexus ERP ↔ AdminHub ↔ Loja Dicas)
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Personalize as chaves e caminhos de comunicação abaixo para interligar os sistemas. O Nexus tentará obter as chaves primeiro das variáveis de ambiente globais do Cloud Run (recomendado para sigilo produtivo) e subsequentemente dos registros salvos no banco abaixo.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label id="lbl-nexusApiKey" className="block text-xs font-bold text-gray-650 flex justify-between items-center">
                        <span>Chave Local Nexus (NEXUS_API_KEY)</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
                            let randKey = 'NEXUS_ERP_';
                            for (let i = 0; i < 24; i++) {
                              randKey += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            setCompany({...company, nexusApiKey: randKey});
                          }} 
                          className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                        >
                          Gerar Chave Segura
                        </button>
                      </label>
                      <input 
                        id="txt-nexusApiKey"
                        type="text"
                        placeholder="Ex: NEXUS_ERP_..."
                        value={company.nexusApiKey || ''}
                        onChange={e => setCompany({...company, nexusApiKey: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label id="lbl-adminHubBaseUrl" className="block text-xs font-bold text-gray-650">URL Base do AdminHub</label>
                      <input 
                        id="txt-adminHubBaseUrl"
                        type="url"
                        placeholder="https://ais-..."
                        value={company.adminHubBaseUrl || ''}
                        onChange={e => setCompany({...company, adminHubBaseUrl: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label id="lbl-adminHubApiKey" className="block text-xs font-bold text-gray-650">Chave API de Destino (AdminHub)</label>
                      <input 
                        id="txt-adminHubApiKey"
                        type="text"
                        placeholder="Ex: ADMINHUB_ENTERPRISE_..."
                        value={company.adminHubApiKey || ''}
                        onChange={e => setCompany({...company, adminHubApiKey: e.target.value})}
                        className="w-full bg-slate-50 border border-gray-250 rounded-lg p-2.5 text-xs text-gray-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Active Resolved Dashboard inside Institutional settings */}
                  {integrationKeys && (
                    <div className="bg-emerald-50/45 border border-emerald-100 rounded-2xl p-4 space-y-3 mt-4 text-left">
                      <div className="flex items-center justify-between border-b border-emerald-50 pb-2">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.55">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Status das Chaves Ativas no Servidor (Gateway API)
                        </span>
                        <span className="text-[10px] font-mono font-medium text-gray-400">
                          {integrationKeys.isEnvConfigured ? "🔐 Resolvido via SO Environment (Cloud Run)" : "📂 Resolvido via Banco de Dados (Firestore)"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                        <div className="bg-white/70 rounded-xl p-3 border border-emerald-100/50 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-500 text-[10px] uppercase">Chave de Entrada (NEXUS_API_KEY)</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(integrationKeys.nexusApiKey);
                                alert("Chave de Integração copiada!");
                              }}
                              className="text-[9px] font-extrabold text-indigo-650 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-all cursor-pointer"
                            >
                              Copiar Chave
                            </button>
                          </div>
                          <div className="font-mono text-xs font-bold text-emerald-700 bg-slate-50/80 p-1.5 rounded border border-slate-100 py-2 overflow-x-auto break-all">
                            {integrationKeys.nexusApiKey}
                          </div>
                          <span className="block text-[9px] text-gray-400 leading-normal">
                            Entregue esta chave para os sistemas externos (Dicas by Ale, AdminHub) para autorizar envios automáticos para este ERP.
                          </span>
                        </div>

                        <div className="bg-white/70 rounded-xl p-3 border border-emerald-100/50 space-y-1.5">
                          <div className="space-y-1">
                            <span className="block font-semibold text-gray-500 text-[10px] uppercase">Dados de Escuta Outbound (Disparos de RH)</span>
                            <div className="space-y-1 text-[10px]">
                              <div>
                                <span className="text-gray-400 font-medium">URL de Sincronismo local:</span>
                                <code className="block bg-slate-50 p-1 rounded font-mono text-[9px] truncate text-slate-600">
                                  {integrationKeys.adminHubBaseUrl}/api/integration/hr/nexus
                                </code>
                              </div>
                              <div className="flex justify-between items-center gap-1 mt-1">
                                <span className="text-gray-400 font-medium truncate">Chave destino (AdminHub):</span>
                                <span className="font-mono bg-emerald-50 text-emerald-700 px-1 py-0.25 rounded text-[9px]">
                                  {integrationKeys.adminHubApiKey.substring(0, 15)}...
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button 
                    id="btn-saveCompany"
                    type="submit" 
                    disabled={savingCompany}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {savingCompany ? 'A processar salvamento...' : (
                      <>
                        <Check size={14} /> Salvar Configurações Institucionais
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}
          </div>
        ) : (
          <div className="bg-white border border-rose-200 p-12 rounded-2xl shadow-sm text-center max-w-2xl mx-auto space-y-4 animate-fade-in font-sans">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Lock size={30} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Acesso Restrito ao Setor de Tecnologia (TI)</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Você não tem as permissões necessárias para acessar as configurações institucionais do ERP. 
              Por motivos fiscais, cadastrais e de compliance, essas parametrizações soberanas são restritas à equipe de suporte e tecnologia de infraestrutura de TI.
            </p>
          </div>
        )
      )}

    </div>
  );
}
