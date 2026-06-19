import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, UserCircle, Rocket } from 'lucide-react';
import { motion } from 'motion/react';

export function SetupView() {
  const { checkSetupStatus, login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [companyCnpj, setCompanyCnpj] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/system/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName, companyCnpj, companyAddress,
          adminName, adminEmail, adminPassword
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        // Setup done, login admin immediately
        await checkSetupStatus();
        login(data.user);
      } else {
        alert("Erro na configuração: " + data.error);
      }
    } catch(err) {
      console.error(err);
      alert("Falha na configuração do sistema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
       <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
          
          <div className="md:w-1/3 bg-blue-600 p-8 text-white flex flex-col justify-center">
            <Rocket size={48} className="mb-6 opacity-80" />
            <h2 className="text-2xl font-bold mb-2">Nexus ERP</h2>
            <p className="text-blue-100 text-sm">Bem-vindo(a) ao setup inicial. Vamos preparar o seu ambiente corporativo.</p>
            
            <div className="mt-12 space-y-4">
              <div className={`flex items-center gap-3 text-sm font-medium ${step >= 1 ? 'text-white' : 'text-blue-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-white bg-white/20' : 'border-blue-300'}`}>1</div>
                Dados da Instituição
              </div>
              <div className={`flex items-center gap-3 text-sm font-medium ${step >= 2 ? 'text-white' : 'text-blue-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-white bg-white/20' : 'border-blue-300'}`}>2</div>
                Administrador de TI
              </div>
            </div>
          </div>

          <div className="md:w-2/3 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {step === 1 ? 'Configure sua Instituição' : 'Conta Administrador de TI'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <motion.div initial={{opacity:0, x:10}} animate={{opacity:1, x:0}}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instituição (Razão Social)</label>
                      <input required autoFocus value={companyName} onChange={e=>setCompanyName(e.target.value)} type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                      <input required value={companyCnpj} onChange={e=>setCompanyCnpj(e.target.value)} type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="00.000.000/0000-00"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                      <textarea required value={companyAddress} onChange={e=>setCompanyAddress(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" rows={3}></textarea>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{opacity:0, x:10}} animate={{opacity:1, x:0}}>
                  <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    O administrador de TI possui acesso irrestrito às funções do sistema para homologação. Apesar de subordinado à diretoria, este perfil é mandatório para iniciar.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input required autoFocus value={adminName} onChange={e=>setAdminName(e.target.value)} type="text" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo</label>
                      <input required value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} type="email" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Senha de Acesso</label>
                      <input required value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} type="password" minLength={6} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100">
                {step === 2 && (
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Voltar
                  </button>
                )}
                <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                   {step === 1 ? 'Continuar' : (loading ? 'Configurando...' : 'Finalizar Setup')}
                </button>
              </div>
            </form>

          </div>
       </div>
    </div>
  )
}
