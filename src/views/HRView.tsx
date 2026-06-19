import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { 
  Users, 
  Plus, 
  Edit2, 
  UserX, 
  BadgeAlert, 
  Printer, 
  Briefcase, 
  UserPlus, 
  X, 
  FileText, 
  FileSignature, 
  Contact, 
  AlertCircle 
} from 'lucide-react';
import { generateStandardPdf } from '../lib/pdfGenerator';
import { cn } from '../lib/utils';

export function HRView() {
  const { users, refreshUsers, currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<User | Partial<User> | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Filter tabs for HR: Active staff vs Dismissed/Arquivo Morto
  const [activeTabSetting, setActiveTabSetting] = useState<'ACTIVE' | 'DISMISSED'>('ACTIVE');

  // Metadata database states
  const [departmentsList, setDepartmentsList] = useState<{ id: string, name: string }[]>([]);
  const [positionsList, setPositionsList] = useState<{ id: string, name: string }[]>([]);

  // Load preset sectors/positions lists
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
      console.error("Error loading HR metadata catalogs:", err);
    }
  };

  // Integration Logs State
  const [integrationLogs, setIntegrationLogs] = useState<any[]>([]);
  const [showIntegrations, setShowIntegrations] = useState(false);

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
    fetchMetadata();
    loadIntegrationLogs();

    const interval = setInterval(() => {
      loadIntegrationLogs();
    }, 6000);
    return () => clearInterval(interval);
  }, [users]);

  // Permission strict checking: HR can hire/edit/dismiss, TI and CEO have admin override
  const canManageHR = () => {
    if (!currentUser) return false;
    return currentUser.department === 'RH' || currentUser.department === 'TI' || currentUser.position === 'CEO' || currentUser.isSystemAdmin;
  };

  const handleCreateClick = () => {
    if (!canManageHR()) {
      alert("Apenas colaboradores autorizados do departamento de RH, TI ou Nível CEO podem contratar funcionários.");
      return;
    }
    const defaults: Partial<User> = { 
      avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${Math.random().toString()}` 
    };
    if (currentUser?.department !== 'TI' && currentUser?.position !== 'CEO') {
      defaults.department = currentUser?.department;
      defaults.role = currentUser?.department;
    }
    setEditingUser(defaults);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || isSavingUser) return;
    if (!canManageHR()) {
      alert("Operação bloqueada: Apenas o departamento de RH, TI ou Nível CEO possuem permissão para lançar ou modificar colaboradores.");
      return;
    }
    
    setIsSavingUser(true);
    const isEditing = !!editingUser.id;
    const url = isEditing ? `/api/users/${editingUser.id}` : '/api/users';
    const method = isEditing ? 'PUT' : 'POST';

    const payload = {
      ...editingUser,
      role: editingUser.department
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Ocorreu um erro ao registrar este colaborador.");
        setIsSavingUser(false);
        return;
      }

      refreshUsers();
      setEditingUser(null);
      alert(isEditing ? 'Colaborador editado com sucesso!' : 'Novo colaborador admitido e registrado!');
    } catch (err) {
      console.error(err);
      alert("Falha de conexão com o servidor de dados.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDismissUser = async (userId: string, name: string) => {
    if (!canManageHR()) {
      alert("Operação bloqueada: Apenas o departamento de RH ou superiores possuem permissão para realizar desligamentos institucionais.");
      return;
    }
    const msg = `ATENÇÃO: Você está prestes a realizar o DESLIGAMENTO de ${name}.\n\nEsta operação revogará as credenciais de login de forma imediata e moverá todos os registros do funcionário para o ARQUIVO MORTO institucional.\n\nTodos os históricos cadastrais, arquivos de pontos e o dossier de pagamentos permanecerão perfeitamente intactos para fins de histórico.\n\nConfirma de fato o desligamento?`;
    
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED' })
      });
      if (res.ok) {
        alert("Desligamento homologado no sistema de RH!");
        refreshUsers();
      } else {
        alert("Erro ao realizar desligamento.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateStandardPdf({
        title: 'NexusERP - Livro e Ficha de Recursos Humanos (RH)',
        generatedBy: currentUser?.name || 'Gestor RH',
        position: currentUser?.position || 'RH',
        fileName: `NexusERP_Ficha_RH_${new Date().getTime()}.pdf`,
        sections: [
          {
            title: 'Análise de Quadro Funcional',
            content: [
              `Total de Funcionários Registrados: ${users.length}`,
              `Funcionários Ativos em Atividade: ${users.filter(u => u.status !== 'DISMISSED').length}`,
              `Colaboradores em Arquivo Morto (Desativados): ${users.filter(u => u.status === 'DISMISSED').length}`
            ]
          },
          {
            title: 'Ficha Cadastral Geral do Staff',
            type: 'table',
            tableHead: ['Colaborador', 'Departamento', 'Cargo', 'E-mail', 'Status'],
            tableBody: users.map(u => [
              u.name,
              u.department,
              u.position,
              u.email,
              u.status === 'DISMISSED' ? 'Inativo (Arquivo Morto)' : 'Ativo'
            ])
          }
        ]
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar ficha setorial de RH.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const departmentsOrder: { [key: string]: number } = {
    'DIRETORIA': 1,
    'FINANCEIRO': 2,
    'ADMINISTRATIVO': 3,
    'MARKETING': 4,
    'COMERCIAL': 5,
    'RH': 6,
    'TI': 7
  };

  const activeUsers = users.filter(u => activeTabSetting === 'ACTIVE' ? u.status !== 'DISMISSED' : u.status === 'DISMISSED');

  const departments = Array.from(new Set([
    ...departmentsList.map(d => d.id),
    ...users.map(u => u.department)
  ])).filter(Boolean).sort((a, b) => (departmentsOrder[a] || 99) - (departmentsOrder[b] || 99));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Admission / Edit Modal Form */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveUser} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh] text-left">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus className="text-blue-600" /> {editingUser.id ? 'Editar Ficha do Colaborador' : 'Admitir Novo Colaborador'}
            </h3>
            
            <div className="space-y-4">
              <div>
                 <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Completo</label>
                 <input required value={editingUser.name || ''} onChange={e => setEditingUser(prev => ({...prev!, name: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-800 font-semibold" />
              </div>
              <div>
                 <label className="block text-xs font-semibold text-gray-700 mb-1">Email Corporativo</label>
                 <input required type="email" value={editingUser.email || ''} onChange={e => setEditingUser(prev => ({...prev!, email: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-800" />
              </div>
              <div>
                 <label className="block text-xs font-semibold text-gray-700 mb-1">Senha {editingUser.id ? '(Deixe em branco para manter a atual)' : 'Inicial'}</label>
                 <input type="password" value={(editingUser as any).password || ''} onChange={e => setEditingUser(prev => ({...prev!, password: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white" minLength={6} placeholder={editingUser.id ? "Nova senha de rede..." : "Senha inicial obrigatória..."} required={!editingUser.id} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-gray-700 mb-1">Departamento</label>
                   <select 
                     required 
                     value={editingUser.department || ''} 
                     disabled={currentUser?.department !== 'TI' && currentUser?.position !== 'CEO' && currentUser?.department !== 'RH'} 
                     onChange={e => setEditingUser(prev => ({...prev!, department: e.target.value as any, role: e.target.value as any}))} 
                     className="w-full border-gray-300 border rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                   >
                      <option value="">Selecione...</option>
                      {departmentsList.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      {departmentsList.length === 0 && (
                        <>
                          <option value="DIRETORIA">Diretoria</option>
                          <option value="FINANCEIRO">Financeiro</option>
                          <option value="ADMINISTRATIVO">Administrativo</option>
                          <option value="MARKETING">Marketing</option>
                          <option value="COMERCIAL">Comercial</option>
                          <option value="RH">Recursos Humanos (RH)</option>
                          <option value="TI">Tecnologia (TI)</option>
                        </>
                      )}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo</label>
                   <select required value={editingUser.position || ''} onChange={e => setEditingUser(prev => ({...prev!, position: e.target.value as any}))} className="w-full border-gray-300 border rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                      <option value="">Selecione...</option>
                      {positionsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {positionsList.length === 0 && (
                        <>
                          <option value="CEO">CEO</option>
                          <option value="DIRETOR">Diretor</option>
                          <option value="GERENTE">Gerente</option>
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="ANALISTA">Analista</option>
                          <option value="VENDEDOR">Vendedor</option>
                          <option value="DESIGNER">Designer</option>
                          <option value="RH">RH</option>
                          <option value="ADMIN_TI">Administrador TI</option>
                          <option value="ACIONISTA">Acionista</option>
                        </>
                      )}
                   </select>
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo de Reporte (Hierarquia Organograma)</label>
                 <select 
                   value={editingUser.superiorId || ''} 
                   onChange={e => setEditingUser(prev => ({...prev!, superiorId: e.target.value || null}))} 
                   className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                 >
                   <option value="">Nenhum (Nível Principal / Direção CEO)</option>
                   {users
                     .filter(u => u.id !== editingUser.id && u.status !== 'DISMISSED')
                     .map(u => (
                       <option key={u.id} value={u.id}>
                         {u.name} ({u.position} - {u.department})
                       </option>
                     ))
                   }
                 </select>
              </div>

              <div>
                 <label className="block text-xs font-semibold text-gray-700 mb-1">Foto do Colaborador (Upload de imagem)</label>
                 <div className="space-y-2">
                   <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 500 * 1024) {
                           alert('Imagem excede o limite do sistema (500KB).');
                           e.target.value = '';
                           return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditingUser(prev => ({...prev!, avatarUrl: ev.target?.result as string}));
                        reader.readAsDataURL(file);
                      }
                   }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-55 file:text-blue-700 hover:file:bg-blue-100" />
                   <input placeholder="Ou insira a URL da imagem perfil" value={editingUser.avatarUrl || ''} onChange={e => setEditingUser(prev => ({...prev!, avatarUrl: e.target.value}))} className="w-full border-gray-300 border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-800" />
                 </div>
              </div>
            </div>
            
            <div className="flex gap-2.5 mt-8 border-t border-gray-150 pt-4">
              <button type="submit" disabled={isSavingUser} className="flex-1 bg-gray-900 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-805 transition-colors">
                {isSavingUser ? "Registrando no ERP..." : "Salvar Dados Cadastrais"}
              </button>
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Header layout row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Contact className="text-blue-600" /> Recursos Humanos (RH)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestão integrada de pessoal, dossiês profissionais, admissão de novos quadros e arquivos de desligamentos.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={handleGeneratePdf} 
            disabled={isGeneratingPdf}
            className="disabled:opacity-50 cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-950 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs"
          >
             <Printer size={16} /> {isGeneratingPdf ? 'Compilando...' : 'Exportar Ficha de Staff PDF'}
          </button>
          {canManageHR() && (
            <button 
              onClick={handleCreateClick} 
              className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus size={16} /> Admitir Colaborador
            </button>
          )}
        </div>
      </div>

      {/* Roster active/dismissed staff tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button 
          onClick={() => setActiveTabSetting('ACTIVE')}
          className={cn(
            "px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer", 
            activeTabSetting === 'ACTIVE' ? "bg-gray-950 text-white shadow-xs" : "bg-slate-100 text-gray-600 hover:bg-slate-200"
          )}
        >
          Pesquisa de Ativos ({users.filter(u => u.status !== 'DISMISSED').length})
        </button>
        <button 
          onClick={() => setActiveTabSetting('DISMISSED')}
          className={cn(
            "px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer", 
            activeTabSetting === 'DISMISSED' ? "bg-red-650 text-white shadow-xs" : "bg-slate-100 text-red-700 hover:bg-red-200"
          )}
        >
          Arquivo Morto ({users.filter(u => u.status === 'DISMISSED').length})
        </button>
      </div>

      {/* Main Staff grid grouped by department */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Department rosters (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {departments.map(dep => {
            const depUsers = users.filter(u => u.department === dep && (activeTabSetting === 'DISMISSED' ? u.status === 'DISMISSED' : u.status !== 'DISMISSED'));
            if (depUsers.length === 0) return null;

            return (
              <div key={dep} className="space-y-3 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2.5 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-gray-450" /> Setor: {dep} ({depUsers.length})
                </h4>
                
                <div className="divide-y divide-gray-100 space-y-3">
                  {depUsers.map(u => {
                    const sup = users.find(x => x.id === u.superiorId);
                    return (
                      <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 text-left">
                        <div className="flex items-center gap-3.5">
                          <img src={u.avatarUrl} alt="" className="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 shadow-xs object-cover" />
                          <div>
                            <h5 className="font-bold text-gray-900 text-sm">{u.name}</h5>
                            <p className="text-xs text-gray-500 font-medium">{u.position}</p>
                            <span className="text-[10px] text-gray-400 font-mono select-all leading-tight">{u.email}</span>
                          </div>
                        </div>

                        {/* Hierarchical direct visual superior anchor */}
                        {sup && (
                          <div className="text-left bg-slate-50 p-2 border border-slate-150 rounded-xl max-w-[130px]">
                            <p className="text-[8px] text-gray-400 uppercase font-black tracking-wider">Líder Hierárquico</p>
                            <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{sup.name.split(' ')[0]}</p>
                          </div>
                        )}

                        {/* Fast management controls */}
                        <div className="flex gap-1.5 justify-end">
                          {canManageHR() && (
                            <button
                              onClick={() => setEditingUser(u)} 
                              className="text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 p-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={12} /> Ficha
                            </button>
                          )}

                          {u.status !== 'DISMISSED' && u.id !== currentUser?.id && canManageHR() && (
                            <button
                              onClick={() => handleDismissUser(u.id, u.name)} 
                              className="text-xs font-bold text-rose-700 border border-rose-220 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Formalizar desligamento do funcionário"
                            >
                              <UserX size={12} /> Desligar
                            </button>
                          )}

                          {u.status === 'DISMISSED' && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg flex items-center gap-1">
                              <BadgeAlert size={12} /> Desligado (Arquivo)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {users.filter(u => activeTabSetting === 'DISMISSED' ? u.status === 'DISMISSED' : u.status !== 'DISMISSED').length === 0 && (
            <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded-3xl text-gray-450">
              <BadgeAlert size={40} className="mx-auto mb-3 opacity-40 text-gray-500 animate-pulse" />
              <p className="font-semibold text-sm">Nenhum funcionário encontrado nesta catalogação.</p>
            </div>
          )}
        </div>

        {/* Informative Side Card Column (Span 1) */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-250 p-6 rounded-3xl shadow-xs text-left space-y-4">
            <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-2.5 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <FileSignature size={15} className="text-blue-500" /> Dossier & Práticas de RH
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              O departamento de Recursos Humanos corporativo é responsável direto pela admissão, atualização e movimentações hierárquicas no organograma do NexusERP.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-105 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-blue-900 flex items-center gap-1"><AlertCircle size={14} /> Atribuição Hierárquica</p>
              <p className="text-blue-800 leading-relaxed">
                Todo funcionário admitido deve possuir um superior corporativo vinculado (com base no Organograma ativo), garantindo o correto trajeto de assinaturas digitais, homologação de ordens de vendas e aprovação de checklists de atividades.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-250 p-6 rounded-3xl shadow-xs text-left space-y-3.5">
            <h4 className="font-bold text-gray-900 border-b border-gray-50 pb-2.5 text-sm uppercase tracking-wider">Estrutura Ativa das Equipes</h4>
            <div className="space-y-2">
              {departmentsOrder && Object.keys(departmentsOrder).map(dep => {
                const count = users.filter(u => u.department === dep && u.status !== 'DISMISSED').length;
                if (count === 0) return null;
                return (
                  <div key={dep} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-600">{dep}</span>
                    <span className="font-mono bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-bold">{count} ativos</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Connected Integration Panel */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs text-left space-y-4 mt-8">
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
          Esta plataforma está integrada com o <strong>AdminHub Enterprise</strong> para intercâmbio de cadastros básicos de RH e escuta o fluxo de contratos fechados da <strong>Loja Dicas by Ale</strong>. Sincronizações de novos admitidos geram automaticamente dossiês em nosso VFS (Virtual File System).
        </p>

        {showIntegrations && (
          <div className="space-y-4 animate-fade-in pt-2 bg-slate-50/20 p-4 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Trilha de Sincronismo Recente (Nexus API Gateway)</h4>
            <div className="overflow-x-auto max-h-85 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 font-extrabold text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-150">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3 font-semibold">Sentido</th>
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
