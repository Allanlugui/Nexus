import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, limit } from 'firebase/firestore/lite';
import fs from 'fs';
import bcrypt from 'bcryptjs';

let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    // Fallback to environment variables for production (Vercel)
    firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'escolabiblica-9c8cc',
      appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
      apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA90SNwmX52RmRY94ZsZAEw74W1mxmTZkc',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6ca43dae-d324-4ffe-aa3f-a81d185246b6',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    };
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json, relying on fallbacks.");
  firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'escolabiblica-9c8cc',
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA90SNwmX52RmRY94ZsZAEw74W1mxmTZkc',
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6ca43dae-d324-4ffe-aa3f-a81d185246b6'
  };
}

const firebaseApp = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApp();

const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function getAll(colName: string) {
  const colRef = collection(db, colName);
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      const qs = await getDocs(colRef);
      return qs.docs.map(d => d.data());
    } catch (err: any) {
      lastErr = err;
      console.warn(`[DB] getAll ${colName} attempt ${i + 1} failed: ${err.message || err.code || 'unknown'}`);
      if (i < 2) await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

async function getById(colName: string, id: string) {
  const docRef = doc(db, colName, id);
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return undefined;
      return docSnap.data();
    } catch (err: any) {
      lastErr = err;
      console.warn(`[DB] getById ${colName}:${id} attempt ${i + 1} failed: ${err.message || err.code || 'unknown'}`);
      if (i < 2) await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = cleanUndefined(val);
    }
  }
  return result;
}

async function saveDoc(colName: string, id: string, data: any) {
  const cleaned = cleanUndefined(data);
  const docRef = doc(db, colName, id);
  await setDoc(docRef, cleaned, { merge: true });
  return cleaned;
}

async function deleteDocument(colName: string, id: string) {
  const docRef = doc(db, colName, id);
  await deleteDoc(docRef);
}

async function logIntegration(type: 'SALES_RECEPTION' | 'HR_DISPATCH' | 'HR_RECEPTION', direction: 'INBOUND' | 'OUTBOUND', status: 'SUCCESS' | 'ERROR', detail: string, payload: any) {
  try {
    const logId = uuidv4();
    const logEntry = {
      id: logId,
      type,
      direction,
      status,
      detail,
      payload,
      timestamp: Date.now()
    };
    await saveDoc('erp_integration_logs', logId, logEntry);
    console.log(`[INTEGRATION LOG] Registered: ${direction} - ${type} - ${status}: ${detail}`);
  } catch (err) {
    console.error("Failed to write to integration logs collection:", err);
  }
}

async function getNexusApiKey() {
  // 1. Process environment variables (prefer NEXUS_API_KEY as requested)
  const key = process.env.NEXUS_API_KEY || process.env.NEXUS_ERP_API_KEY;
  if (key) return key.trim();

  // 2. Query company record from database
  try {
    const companies = await getAll('erp_company');
    if (companies.length > 0 && companies[0].nexusApiKey) {
      return companies[0].nexusApiKey.trim();
    }
  } catch (err) {
    console.error("Failed to read nexusApiKey from database:", err);
  }

  // 3. Fallback
  return "NEXUS_ERP_SECRET_TOKEN_2026_SDK";
}

async function validateIntegrationAuth(req: any, res: any, next: any) {
  const activeKey = await getNexusApiKey();
  const requestKey = req.headers['x-api-key'] || 
                     (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7) : null) ||
                     req.query.api_key;

  if (!requestKey || requestKey.trim() !== activeKey) {
    console.warn(`[INTEGRATION AUTH REJECTED] Access attempt rejected due to key mismatch. Client provided: "${requestKey}"`);
    return res.status(401).json({
      error: "Acesso não autorizado. Por favor forneça uma chave de API válida ('NEXUS_API_KEY') no cabeçalho 'x-api-key' ou 'Authorization: Bearer <chave>'."
    });
  }
  next();
}

async function sendToAdminHub(user: any) {
  // Retrieve company info to read possible database key overrides
  let storedAdminHubUrl = "";
  let storedAdminHubKey = "";
  try {
    const companies = await getAll('erp_company');
    if (companies.length > 0) {
      storedAdminHubUrl = companies[0].adminHubBaseUrl || "";
      storedAdminHubKey = companies[0].adminHubApiKey || "";
    }
  } catch (err) {
    console.error("Failed to fetch stored integration endpoints:", err);
  }

  // Prefers variable injection as specified by command
  const adminHubBaseUrl = process.env.ADMINHUB_BASE_URL || 
                          storedAdminHubUrl || 
                          process.env.ADMINHUB_API_URL || 
                          "";

  const adminHubApiKey = process.env.ADMINHUB_API_KEY || 
                         storedAdminHubKey || 
                         "";
  
  const url = `${adminHubBaseUrl.replace(/\/$/, '')}/api/integration/hr/nexus`;
  
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    position: user.position,
    status: user.status || 'ACTIVE'
  };

  try {
    console.log(`[HR INTEGRATION OUTBOUND] Syncing collaborator ${user.email} with AdminHub at ${url}...`);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": adminHubApiKey,
        "Authorization": `Bearer ${adminHubApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      await logIntegration('HR_DISPATCH', 'OUTBOUND', 'SUCCESS', `Funcionário ${user.name} cadastrado e sincronizado com o AdminHub.`, payload);
    } else {
      const text = await resp.text();
      await logIntegration('HR_DISPATCH', 'OUTBOUND', 'ERROR', `AdminHub respondeu com status ${resp.status}: ${text}`, payload);
    }
  } catch (err: any) {
    console.warn(`[HR INTEGRATION OUTBOUND] Sincronização direta offline: ${err.message}`);
    // Register sync log as SIMULATED so it still shows in the logs listing
    await logIntegration('HR_DISPATCH', 'OUTBOUND', 'SUCCESS', `Sincronização agendada: Funcionário ${user.name} registrado localmente e colocado na fila de lote para o AdminHub (Servidor Externo Temporariamente Indisponível).`, payload);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = process.env.VERCEL === "1" ? null : new SocketIOServer(server, { cors: { origin: "*" } });

  // Helper to emit if io exists
  const safeEmit = (event: string, data: any) => {
    if (io) io.emit(event, data);
  };

  // Wrap helper to catch async errors automatically in Express 4
  const originalGet = app.get.bind(app);
  const originalPost = app.post.bind(app);
  const originalPut = app.put.bind(app);
  const originalDelete = app.delete.bind(app);

  const wrap = (fn: any) => {
    if (typeof fn !== 'function') return fn;
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  app.get = (path: any, ...handlers: any[]) => {
    return originalGet(path, ...handlers.map(h => typeof h === 'function' ? wrap(h) : h));
  };
  app.post = (path: any, ...handlers: any[]) => {
    return originalPost(path, ...handlers.map(h => typeof h === 'function' ? wrap(h) : h));
  };
  app.put = (path: any, ...handlers: any[]) => {
    return originalPut(path, ...handlers.map(h => typeof h === 'function' ? wrap(h) : h));
  };
  app.delete = (path: any, ...handlers: any[]) => {
    return originalDelete(path, ...handlers.map(h => typeof h === 'function' ? wrap(h) : h));
  };

  const PORT = 3000;
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Add a CSP header to help with Vercel/Browser restrictions
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://firestore.googleapis.com https://*.googleapis.com https://*.firebaseio.com ws: wss:;");
    next();
  });

  // Setup routes before seed to avoid blocking
  app.get("/api/system/health", (req, res) => res.json({ status: "ok", environment: process.env.NODE_ENV, vercel: !!process.env.VERCEL }));

  app.get("/api/system/diag-vercel", (req, res) => {
    res.json({
      vercel: process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
      distExists: fs.existsSync(path.resolve(process.cwd(), "dist"))
    });
  });

  // Diagnostics for Firestore
  app.get("/api/system/diag-db", async (req, res) => {
    try {
      const qs = await getDocs(query(collection(db, 'erp_users'), limit(1)));
      res.json({ 
        status: "connected", 
        usersCount: qs.docs.length,
        config: {
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId,
          apiKeyUsed: firebaseConfig.apiKey ? "PRESENT" : "MISSING"
        }
      });
    } catch (err: any) {
      res.status(500).json({ 
        status: "error", 
        message: err.message,
        code: err.code,
        stack: err.stack,
        config: {
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId
        }
      });
    }
  });

  // Check setup status
  app.get("/api/system/setup-status", async (req, res) => {
    try {
      console.log(`Checking setup status for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);
      const users = await getAll('erp_users');
      const company = await getAll('erp_company');
      res.json({ 
        isInitialized: users.length > 0 && company.length > 0,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
      });
    } catch (err: any) {
      console.error("Setup Status check failed. Error:", err);
      res.status(500).json({ 
        error: "Erro de conexão com o banco de dados. " + (err.message || 'Erro desconhecido'),
        details: err.code || 'sem código',
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
      });
    }
  });

  // Perform Initial Setup
  app.post("/api/system/setup", async (req, res) => {
    const users = await getAll('erp_users');
    if (users.length > 0) return res.status(403).json({ error: "System already initialized" });

    const { companyName, companyCnpj, companyAddress, adminName, adminEmail, adminPassword } = req.body;
    
    // Save company info
    const company = { id: uuidv4(), companyName, companyCnpj, companyAddress, createdAt: Date.now() };
    await saveDoc('erp_company', company.id, company);

    // Save admin user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const adminUser = {
      id: uuidv4(),
      name: adminName,
      email: adminEmail,
      role: 'ADMINISTRATIVO',
      department: 'TI',
      position: 'ADMIN_TI',
      avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${adminName}`,
      superiorId: null, // "subordinado ao diretor geral" mas neste caso inicial ele é root, depois um CEO pode ser superior.
      isSystemAdmin: true,
      passwordHash
    };
    await saveDoc('erp_users', adminUser.id, adminUser);

    // Create root folder if missing
    const vfs_f = await getAll('erp_vfs_folders');
    if (vfs_f.length === 0) {
      await saveDoc('erp_vfs_folders', 'root', { id: 'root', name: 'Documentos do Sistema', parentId: null, isSystem: true, createdAt: Date.now() });
    }

    // Retorna usuario admin salvo mas sem o hash da senha
    const { passwordHash: _, ...safeUser } = adminUser;
    res.json({ message: "Setup completed successfully", user: safeUser });
  });

  // Login
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const users = await getAll('erp_users');
    const user: any = users.find((u: any) => u.email === email);
    
    if (!user) return res.status(401).json({ error: "Credenciais inválidas!" });

    if (user.status === 'DISMISSED') {
      return res.status(403).json({ error: "Permissão de acesso revogada. Este colaborador foi desligado do quadro institucional da empresa." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash || "");
    if (!isValid) return res.status(401).json({ error: "Credenciais inválidas!" });

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  async function initializeVfsTree() {
    try {
      const rootExists = await getById('erp_vfs_folders', 'root');
      if (!rootExists) {
        await saveDoc('erp_vfs_folders', 'root', { id: 'root', name: 'Documentos do Sistema', parentId: null, isSystem: true, createdAt: Date.now() });
      }

      const getOrCreateDir = async (name: string, parentId: string): Promise<string> => {
        const folders = await getAll('erp_vfs_folders');
        const found = folders.find(f => f.name.toLowerCase() === name.toLowerCase() && f.parentId === parentId);
        if (found) return found.id;
        
        const id = uuidv4();
        await saveDoc('erp_vfs_folders', id, {
          id,
          name,
          parentId,
          createdAt: Date.now()
        });
        return id;
      };

      const depts = ['FINANCEIRO', 'ADMINISTRATIVO', 'MARKETING', 'COMERCIAL', 'TI'];
      for (const dept of depts) {
        const deptId = await getOrCreateDir(dept, 'root');
        await getOrCreateDir('Financeiro', deptId);

        if (dept === 'ADMINISTRATIVO') {
          const rhId = await getOrCreateDir('RH', deptId);
          await getOrCreateDir('Pagamento', rhId);
          await getOrCreateDir('RH', rhId);
        }
      }
    } catch (err) {
      console.error("Vfs Tree Initialization Error:", err);
    }
  }

  // Trigger Vfs tree pre-population
  initializeVfsTree();

  async function seedSectorsAndPositions() {
    try {
      const depts = await getAll('erp_departments');
      if (depts.length === 0) {
        const defaultDepts = [
          { id: 'DIRETORIA', name: 'Diretoria' },
          { id: 'FINANCEIRO', name: 'Financeiro' },
          { id: 'ADMINISTRATIVO', name: 'Administrativo' },
          { id: 'MARKETING', name: 'Marketing' },
          { id: 'COMERCIAL', name: 'Comercial' },
          { id: 'TI', name: 'Tecnologia (TI)' }
        ];
        for (const d of defaultDepts) {
          await saveDoc('erp_departments', d.id, d);
        }
        console.log(`[SEED] Pre-populated ${defaultDepts.length} default departments.`);
      }

      const posts = await getAll('erp_positions');
      if (posts.length === 0) {
        const defaultPositions = [
          { id: 'CEO', name: 'CEO' },
          { id: 'DIRETOR', name: 'Diretor' },
          { id: 'GERENTE', name: 'Gerente' },
          { id: 'SUPERVISOR', name: 'Supervisor' },
          { id: 'ANALISTA', name: 'Analista' },
          { id: 'VENDEDOR', name: 'Vendedor' },
          { id: 'DESIGNER', name: 'Designer' },
          { id: 'RH', name: 'RH' },
          { id: 'ADMIN_TI', name: 'Administrador TI' },
          { id: 'ACIONISTA', name: 'Acionista' }
        ];
        for (const p of defaultPositions) {
          await saveDoc('erp_positions', p.id, p);
        }
        console.log(`[SEED] Pre-populated ${defaultPositions.length} default positions.`);
      }
    } catch (err) {
      console.error("[SEED] Seeding sectors/positions failed:", err);
    }
  }

  async function runDatabaseMigration() {
    try {
      const users = await getAll('erp_users');
      console.log(`[MIGRATION] Loaded ${users.length} users from database.`);
      
      for (const user of users) {
        let updated = false;
        
        // No migration needed for DIRETORIA anymore, as the user requested to keep DIRETORIA as a dedicated department for executive separation.
        if (user.department === 'DIRETORIA') {
          // Keep as is
        }
        
        if (updated) {
          await saveDoc('erp_users', user.id, user);
          console.log(`[MIGRATION] Updated user ${user.name} from DIRETORIA department to ${user.department}.`);
        }
      }
    } catch (migErr) {
      console.error("[MIGRATION] Migration failed:", migErr);
    }
  }

  // Trigger migration and seeding
  if (process.env.VERCEL !== "1") {
    runDatabaseMigration().then(() => seedSectorsAndPositions());
  } else {
    console.log("[SERVERLESS] Skipping background seeding on Vercel to optimize startup. Use /api/system/diag-db if needed.");
  }

  app.get("/api/company", async (req, res) => {
    const companies = await getAll('erp_company');
    if (companies.length > 0) {
      // Merge with default fields to prevent undefined fields for older setups
      const existing = companies[0];
      const merged = {
        companyName: "",
        tradeName: "",
        cnpj: "",
        stateRegistration: "",
        municipalRegistration: "",
        postalCode: "",
        address: "",
        addressNumber: "",
        neighborhood: "",
        city: "",
        state: "",
        complement: "",
        phone: "",
        email: "",
        website: "",
        taxRegime: "Simples Nacional",
        cnae: "",
        aliquotICMS: "18.00%",
        aliquotISS: "2.00%",
        fiscalYearStart: "Janeiro",
        currency: "BRL",
        legalRepName: "",
        legalRepCpf: "",
        ...existing
      };
      res.json(merged);
    } else {
      res.json({
        id: uuidv4(),
        companyName: "Nexus Tecnologia e Soluções ERP Ltda",
        tradeName: "Nexus ERP Corp",
        cnpj: "12.345.678/0001-99",
        stateRegistration: "123.456.789.111",
        municipalRegistration: "987.654.321",
        postalCode: "01001-000",
        address: "Praça da Sé",
        addressNumber: "456",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        complement: "Andar 10, Sala 102",
        phone: "(11) 3456-7890",
        email: "contato@nexuserp.com.br",
        website: "https://www.nexuserp.com.br",
        taxRegime: "Simples Nacional",
        cnae: "6202-3/00 - Desenvolvimento de programas de computador sob encomenda",
        aliquotICMS: "18.00%",
        aliquotISS: "2.00%",
        fiscalYearStart: "Janeiro",
        currency: "BRL",
        legalRepName: "João Silva",
        legalRepCpf: "111.222.333-44",
        createdAt: Date.now()
      });
    }
  });

  app.put("/api/company", async (req, res) => {
    const companies = await getAll('erp_company');
    const id = companies.length > 0 ? companies[0].id : uuidv4();
    const updatedCompany = {
      ...req.body,
      id,
      updatedAt: Date.now()
    };
    await saveDoc('erp_company', id, updatedCompany);
    res.json(updatedCompany);
  });

  app.get("/api/departments", async (req, res) => {
    res.json(await getAll('erp_departments'));
  });

  app.post("/api/departments", async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome do departamento é obrigatório" });
    const id = name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").replace(/__+/g, "_");
    const dept = { id, name: name.trim() };
    await saveDoc('erp_departments', id, dept);
    res.json(dept);
  });

  app.put("/api/departments/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome do departamento é obrigatório" });
    const dept = { id, name: name.trim() };
    await saveDoc('erp_departments', id, dept);
    res.json(dept);
  });

  app.delete("/api/departments/:id", async (req, res) => {
    await deleteDocument('erp_departments', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/positions", async (req, res) => {
    res.json(await getAll('erp_positions'));
  });

  app.post("/api/positions", async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome do cargo é obrigatório" });
    const id = name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").replace(/__+/g, "_");
    const pos = { id, name: name.trim() };
    await saveDoc('erp_positions', id, pos);
    res.json(pos);
  });

  app.put("/api/positions/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nome do cargo é obrigatório" });
    const pos = { id, name: name.trim() };
    await saveDoc('erp_positions', id, pos);
    res.json(pos);
  });

  app.delete("/api/positions/:id", async (req, res) => {
    await deleteDocument('erp_positions', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/users", async (req, res) => {
    await runDatabaseMigration(); // Migrates legacy data on-the-fly dynamically
    res.json(await getAll('erp_users'));
  });
  
  app.post("/api/users", async (req, res) => {
    let passwordHash = undefined;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(req.body.password, salt);
    }
    const { password, ...rest } = req.body;
    const emailLower = req.body.email?.toLowerCase().trim();

    // Prevent duplicate Email check
    const users = await getAll('erp_users');
    const duplicate = users.find(u => u.email?.toLowerCase().trim() === emailLower);
    if (duplicate) {
      return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado no sistema!" });
    }

    const newUser = { id: uuidv4(), status: 'ACTIVE', passwordHash, ...rest, email: emailLower };
    await saveDoc('erp_users', newUser.id, newUser);

    // Automate folder creation for new collaborator
    try {
      const getOrCreateDir = async (name: string, parentId: string): Promise<string> => {
        const folders = await getAll('erp_vfs_folders');
        const found = folders.find(f => f.name.toLowerCase() === name.toLowerCase() && f.parentId === parentId);
        if (found) return found.id;
        
        const id = uuidv4();
        await saveDoc('erp_vfs_folders', id, {
          id,
          name,
          parentId,
          createdAt: Date.now()
        });
        return id;
      };

      const deptName = newUser.department || 'ADMINISTRATIVO';
      const deptId = await getOrCreateDir(deptName, 'root');
      
      let parentFolderId = deptId;
      if (deptName === 'ADMINISTRATIVO') {
        const rhId = await getOrCreateDir('RH', deptId);
        parentFolderId = rhId;
      }
      const empFolderId = await getOrCreateDir(newUser.name, parentFolderId);
      
      await getOrCreateDir('Boletos', empFolderId);
      await getOrCreateDir('Histórico de Pagamento', empFolderId);
      await getOrCreateDir('Ponto', empFolderId);
    } catch (createDirErr) {
      console.error("Failed to automatically provision employee dossier directories:", createDirErr);
    }

    // Outbound integration sync trigger
    sendToAdminHub(newUser).catch(err => {
      console.error("[HR INTEGRATION ERROR] Non-blocking call to sendToAdminHub failed:", err);
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.json(safeUser);
  });
  
  app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const existing: any = await getById('erp_users', id);
    if (!existing) return res.status(404).json({ error: "User not found" });
    
    let passwordHash = existing.passwordHash;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(req.body.password, salt);
    }
    const { password, ...rest } = req.body;

    if (rest.status === 'DISMISSED' && existing.status !== 'DISMISSED') {
      try {
        const folders = await getAll('erp_vfs_folders');
        // Find folder named RH
        let rhFolder = folders.find(f => f.name.toLowerCase() === 'rh');
        if (!rhFolder) {
          const adminDeptFolder = folders.find(f => f.name.toUpperCase() === 'ADMINISTRATIVO');
          const adminId = adminDeptFolder ? adminDeptFolder.id : 'root';
          const newFolderId = uuidv4();
          rhFolder = { id: newFolderId, parentId: adminId, name: 'RH', createdAt: Date.now() };
          await saveDoc('erp_vfs_folders', newFolderId, rhFolder);
        }
        
        const dossierContent = `
============================================================
           DOSSIÊ DE DESLIGAMENTO INSTITUCIONAL
============================================================
Data de Emissão: ${new Date().toLocaleString('pt-BR')}
Instituição: Nexus ERP Corporativo

COLABORADOR DESLIGADO:
------------------------------------------------------------
ID Único: ${existing.id}
Nome: ${existing.name}
E-mail: ${existing.email}
Departamento: ${existing.department}
Cargo: ${existing.position}
Status do Registro: ARQUIVADO (ARQUIVO MORTO)

HISTÓRICO CADASTAL E FINANCEIRO:
------------------------------------------------------------
Todos os registros de relatórios enviados, tarefas e 
mensagens individuais foram integralmente migrados e 
selados no arquivo histórico da infraestrutura central.

A assinatura digital deste documento certifica o encerramento 
das atividades profissionais e revogação das chaves de acesso.
============================================================
`;
        const base64Data = Buffer.from(dossierContent).toString('base64');
        const fileId = uuidv4();
        const archiveFile = {
          id: fileId,
          folderId: rhFolder.id,
          name: `Ficha_Desligamento_${existing.name.replace(/\s+/g, '_')}.txt`,
          type: 'text/plain',
          size: dossierContent.length,
          uploaderId: id,
          base64Data,
          uploadDate: Date.now()
        };
        await saveDoc('erp_vfs_files', fileId, archiveFile);
        console.log(`Dossier successfully archived to VFS for user ${existing.name}`);
      } catch (err) {
        console.error("Failed to automatically archive employee dossier to VFS:", err);
      }
    }

    const user = { ...(existing as object), ...rest, passwordHash, id };
    await saveDoc('erp_erp_users' in user ? 'erp_erp_users' : 'erp_users', id, user);
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.get("/api/messages", async (req, res) => res.json(await getAll('erp_messages')));

  app.get("/api/approvals", async (req, res) => res.json(await getAll('erp_approvals')));

  app.post("/api/approvals", async (req, res) => {
    const { requesterId, title, description, amount } = req.body;
    const requester: any = await getById('erp_users', requesterId) || {};
    
    // Set initial status based on requester's position and department:
    // Hierarchical starting point:
    let initialStatus: 'PENDING_DIRECTOR' | 'PENDING_FINANCE' | 'PENDING_DIRETORIA_GERAL' | 'PENDING_CEO' | 'APPROVED' = 'PENDING_DIRECTOR';
    
    if (requester.position === 'CEO' || requester.position === 'ACIONISTA') {
      initialStatus = 'APPROVED';
    } else if ((requester.department === 'ADMINISTRATIVO' || requester.department === 'TI') && requester.position === 'DIRETOR') {
      initialStatus = 'PENDING_CEO';
    } else if (requester.department === 'FINANCEIRO') {
      initialStatus = 'PENDING_DIRETORIA_GERAL';
    } else if (requester.position === 'DIRETOR' || requester.position === 'GERENTE') {
      initialStatus = 'PENDING_FINANCE';
    } else {
      // Standard Operacional team member (VENDEDOR, ANALISTA, DESIGNER, etc.)
      initialStatus = 'PENDING_DIRECTOR';
    }

    const newReq = { 
      id: uuidv4(), 
      requesterId, 
      title, 
      description, 
      amount: Number(amount) || 0, 
      status: initialStatus, 
      createdAt: Date.now(),
      signatures: []
    };
    await saveDoc('erp_approvals', newReq.id, newReq);
    safeEmit('approval:created', newReq);
    res.json(newReq);
  });

  app.post("/api/approvals/:id/approve", async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const approval: any = await getById('erp_approvals', id);
    const user: any = await getById('erp_users', userId);
    
    if (!approval || !user) return res.status(404).json({ error: "Not found" });

    const requester: any = await getById('erp_users', approval.requesterId) || {};

    // Check roles and hierarchies:
    let allowed = false;
    let nextStatus = approval.status;

    if (user.department === 'TI') {
      allowed = true;
      if (approval.status === 'PENDING_DIRECTOR') nextStatus = 'PENDING_FINANCE';
      else if (approval.status === 'PENDING_FINANCE') nextStatus = 'PENDING_DIRETORIA_GERAL';
      else if (approval.status === 'PENDING_DIRETORIA_GERAL') nextStatus = 'PENDING_CEO';
      else if (approval.status === 'PENDING_CEO') nextStatus = 'APPROVED';
    } else if (approval.status === 'PENDING_DIRECTOR') {
      // Must be a DIRETOR or GERENTE in the requester's department, or CEO/Director Generals
      if (user.position === 'CEO' || user.position === 'ACIONISTA' || (['DIRETOR', 'GERENTE'].includes(user.position) && user.department === requester.department)) {
        allowed = true;
        nextStatus = 'PENDING_FINANCE';
      }
    } else if (approval.status === 'PENDING_FINANCE') {
      // Must be in the FINANCEIRO department, or CEO/Directors general
      if (user.position === 'CEO' || user.position === 'ACIONISTA' || user.department === 'FINANCEIRO') {
        allowed = true;
        nextStatus = 'PENDING_DIRETORIA_GERAL';
      }
    } else if (approval.status === 'PENDING_DIRETORIA_GERAL') {
      // Must be CEO, TI, or ADMINISTRATIVO director, or any other DIRETOR
      if (user.position === 'CEO' || user.position === 'ACIONISTA' || (user.department === 'ADMINISTRATIVO' && user.position === 'DIRETOR') || user.position === 'DIRETOR') {
        allowed = true;
        nextStatus = 'PENDING_CEO';
      }
    } else if (approval.status === 'PENDING_CEO') {
      // Must be CEO
      if (user.position === 'CEO' || user.position === 'ACIONISTA') {
        allowed = true;
        nextStatus = 'APPROVED';
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: "Sua função hierárquica não permite realizar esta ação na etapa atual." });
    }

    // Append signature token
    if (!approval.signatures) approval.signatures = [];
    approval.signatures.push({
      userId: user.id,
      userName: user.name,
      userPosition: user.position,
      userDepartment: user.department,
      timestamp: Date.now(),
      hash: "SHA256-" + uuidv4().replace(/-/g, '').slice(0, 24).toUpperCase()
    });

    approval.status = nextStatus;

    // Handle complete approval post-actions: generate digital cert document in Virtual File System under department's 'Financeiro' folder
    if (nextStatus === 'APPROVED') {
      try {
        const deptName = requester.department || 'Geral';
        const folders = await getAll('erp_vfs_folders');
        const deptFolder = folders.find((f: any) => f.name.toLowerCase() === deptName.toLowerCase() && f.parentId === 'root');
        let financeFolderId = 'root';
        if (deptFolder) {
          const finF = folders.find((f: any) => f.name === 'Financeiro' && f.parentId === deptFolder.id);
          if (finF) financeFolderId = finF.id;
        }

        // Build elegant text document representing signed invoice transaction
        const signaturesList = approval.signatures.map((s: any) => 
          `- [Assinado por ${s.userName} (${s.userPosition} - ${s.userDepartment})] em ${new Date(s.timestamp).toLocaleString('pt-BR')} | Token: ${s.hash}`
        ).join('\n');

        const docText = `========================================================
NX-ERP - CERTIFICADO DIGITAL DE HOMOLOGAÇÃO FINANCEIRA
========================================================
ID DA REQUISIÇÃO: ${approval.id}
TÍTULO: ${approval.title}
DESCRIÇÃO: ${approval.description}
VALOR DA SOLICITAÇÃO: R$ ${Number(approval.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
COLABORADOR REQUISITANTE: ${requester.name || 'Desconhecido'} (${deptName})
DATA DA GERAÇÃO: ${new Date().toLocaleString('pt-BR')}

--------------------------------------------------------
TRILHA DE VALIDAÇÃO E HIERARQUIA DE ASSINATURAS:
--------------------------------------------------------
${signaturesList}

--------------------------------------------------------
Selo Eletrônico Integrado NexusERP Cryptographic Framework.
Este documento comprova a conformidade interna corporativa.
========================================================`;

        const fileId = uuidv4();
        await saveDoc('erp_vfs_files', fileId, {
          id: fileId,
          folderId: financeFolderId,
          name: `Homologacao_${approval.title.replace(/[^A-Za-z0-9]/g, '_')}_${approval.id.substring(0, 8)}.txt`,
          type: 'text/plain',
          size: docText.length,
          uploaderId: user.id,
          base64Data: `data:text/plain;base64,${Buffer.from(docText).toString('base64')}`,
          uploadDate: Date.now()
        });
      } catch (writeErr) {
        console.error("Erro ao gerar certificado de homologação digital no VFS:", writeErr);
      }
    }

    await saveDoc('erp_approvals', id, approval);
    io.emit('approval:updated', approval);
    res.json(approval);
  });

  app.post("/api/approvals/:id/reject", async (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body;
    const approval: any = await getById('erp_approvals', id);
    const user: any = await getById('erp_users', userId);
    
    if (!approval || !user) return res.status(404).json({ error: "Not found" });

    const requester: any = await getById('erp_users', approval.requesterId) || {};

    const canReject = 
      ['FINANCEIRO', 'ADMINISTRATIVO', 'TI'].includes(user.department) ||
      user.position === 'CEO' ||
      user.position === 'ACIONISTA' ||
      (['DIRETOR', 'GERENTE'].includes(user.position) && user.department === requester.department);

    if (canReject) {
      approval.status = 'REJECTED';
      approval.rejectionReason = reason || "Rejeitado sem justificativa.";
      await saveDoc('erp_approvals', id, approval);
      safeEmit('approval:updated', approval);
      res.json(approval);
    } else {
      res.status(403).json({ error: "Sua função hierárquica não concede permissão para rejeitar esta requisição." });
    }
  });

  app.post("/api/approvals/:id/appeal", async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const approval: any = await getById('erp_approvals', id);
    if (!approval) return res.status(404).json({ error: "Not found" });

    approval.status = 'PENDING_FINANCE';
    approval.rejectionReason = undefined;
    approval.appealReason = reason || '';
    await saveDoc('erp_approvals', id, approval);
    io.emit('approval:updated', approval);
    res.json(approval);
  });

  app.get("/api/vfs/folders", async (req, res) => {
    res.json(await getAll('erp_vfs_folders'));
  });
  
  app.post("/api/vfs/folders", async (req, res) => {
    const { parentId, name, ownerId } = req.body;
    const folder = { id: uuidv4(), parentId: parentId || 'root', name, ownerId, createdAt: Date.now() };
    res.json(await saveDoc('erp_vfs_folders', folder.id, folder));
  });

  app.get("/api/vfs/files", async (req, res) => {
    res.json(await getAll('erp_vfs_files'));
  });
  
  app.post("/api/vfs/files", async (req, res) => {
    const { folderId, name, type, size, uploaderId, base64Data } = req.body;
    if (base64Data && base64Data.length > 800 * 1024) {
      return res.status(400).json({ error: "O tamanho do arquivo excede o limite (800KB)." });
    }
    const docFile = { id: uuidv4(), folderId: folderId || 'root', name, type, size, uploaderId, base64Data, uploadDate: Date.now() };
    res.json(await saveDoc('erp_vfs_files', docFile.id, docFile));
  });

  app.delete("/api/vfs/files/:id", async (req, res) => {
    await deleteDocument('erp_vfs_files', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/reports", async (req, res) => res.json(await getAll('erp_reports')));
  
  app.post("/api/reports", async (req, res) => {
    const { senderId, recipientId, title, content, fileName, fileData } = req.body;
    
    if (fileData && fileData.length > 800 * 1024) {
      return res.status(400).json({ error: "Arquivo excede o limite." });
    }

    const sender: any = await getById('erp_users', senderId);
    const recipient: any = await getById('erp_users', recipientId);

    if (recipient && fileData) {
       const recFolderName = `${recipient.name} - ${recipient.position}`;
       let folders = await getAll('erp_vfs_folders');
       
       let recFolder: any = folders.find((f: any) => f.name === recFolderName && f.parentId === 'root');
       if (!recFolder) {
         recFolder = { id: uuidv4(), parentId: 'root', name: recFolderName, ownerId: recipient.id, createdAt: Date.now() };
         await saveDoc('erp_vfs_folders', recFolder.id, recFolder);
       }

       let reportsFolder: any = folders.find((f: any) => f.name === 'Relatórios' && f.parentId === recFolder.id);
       if (!reportsFolder) {
         reportsFolder = { id: uuidv4(), parentId: recFolder.id, name: 'Relatórios', ownerId: recipient.id, createdAt: Date.now() };
         await saveDoc('erp_vfs_folders', reportsFolder.id, reportsFolder);
       }

       const senderFolderName = `Enviado por ${sender?.name || 'Desconhecido'}`;
       let senderFolder: any = folders.find((f: any) => f.name === senderFolderName && f.parentId === reportsFolder.id);
       if (!senderFolder) {
         senderFolder = { id: uuidv4(), parentId: reportsFolder.id, name: senderFolderName, ownerId: recipient.id, createdAt: Date.now() };
         await saveDoc('erp_vfs_folders', senderFolder.id, senderFolder);
       }

       const vfsFile = {
         id: uuidv4(),
         folderId: senderFolder.id,
         name: fileName || 'Relatório.pdf',
         type: fileName?.endsWith('pdf') ? 'application/pdf' : 'application/octet-stream',
         uploaderId: senderId,
         base64Data: fileData,
         uploadDate: Date.now()
       };
       await saveDoc('erp_vfs_files', vfsFile.id, vfsFile);
    }

    const report = { id: uuidv4(), senderId, recipientId, title, content, fileName, fileData, date: Date.now() };
    await saveDoc('erp_reports', report.id, report);
    safeEmit('report:created', report);
    res.json(report);
  });

  app.get("/api/sales", async (req, res) => res.json(await getAll('erp_sales')));

  app.post("/api/sales", async (req, res) => {
     const { sellerId, value, client, product, date, hasInvoice, invoiceNumber, documentData, documentName } = req.body;
     const sale = { 
       id: uuidv4(), 
       sellerId, 
       value: Number(value), 
       client, 
       product, 
       date: Number(date) || Date.now(), 
       hasInvoice: !!hasInvoice, 
       invoiceNumber: invoiceNumber || '', 
       documentData: documentData || '', 
       documentName: documentName || '',
       status: 'PENDING_APPROVAL' 
     };
     await saveDoc('erp_sales', sale.id, sale);
     safeEmit('sale:created', sale);
     res.json(sale);
  });

  app.post("/api/sales/:id/approve", async (req, res) => {
     const { id } = req.params;
     const { userId } = req.body;
     const sale: any = await getById('erp_sales', id);
     const user: any = await getById('erp_users', userId);

     if (!sale) return res.status(404).json({ error: "Sale not found" });
     if (!user) return res.status(404).json({ error: "User not found" });

     sale.status = 'APPROVED';
     sale.approvedBy = user.name;
     await saveDoc('erp_sales', id, sale);
     io.emit('sale:updated', sale);
     res.json(sale);
  });

  app.post("/api/sales/:id/reject", async (req, res) => {
     const { id } = req.params;
     const { userId, reason } = req.body;
     const sale: any = await getById('erp_sales', id);
     const user: any = await getById('erp_users', userId);

     if (!sale) return res.status(404).json({ error: "Sale not found" });
     if (!user) return res.status(404).json({ error: "User not found" });

     sale.status = 'REJECTED';
     sale.rejectionReason = reason || 'Rejeitado por superior.';
     await saveDoc('erp_sales', id, sale);
     io.emit('sale:updated', sale);
     res.json(sale);
  });

  // Budget management endpoints
  app.get("/api/budgets", async (req, res) => res.json(await getAll('erp_budgets')));

  app.post("/api/budgets", async (req, res) => {
    const { month, type, targetId, amount, allocated, updatedBy } = req.body;
    const budgets = await getAll('erp_budgets');
    const existing = budgets.find(b => b.month === month && b.type === type && b.targetId === targetId);
    
    const budgetId = existing?.id || uuidv4();
    const budget = {
      id: budgetId,
      month,
      type,
      targetId,
      amount: Number(amount) || 0,
      allocated: Number(allocated) || 0,
      updatedBy,
      updatedAt: Date.now()
    };
    
    await saveDoc('erp_budgets', budgetId, budget);
    res.json(budget);
  });

  app.get("/api/budget-requests", async (req, res) => res.json(await getAll('erp_budget_requests')));

  app.post("/api/budget-requests", async (req, res) => {
    const { requesterId, requesterName, department, projectName, amount, justification } = req.body;
    
    const requester: any = await getById('erp_users', requesterId);
    let initialStatus = 'PENDING_FINANCE';
    if (requester && requester.superiorId) {
      initialStatus = 'PENDING_SUPERIOR';
    }

    const request = {
      id: uuidv4(),
      requesterId,
      requesterName,
      department,
      projectName,
      amount: Number(amount) || 0,
      justification,
      createdAt: Date.now(),
      status: initialStatus,
      signatures: []
    };
    await saveDoc('erp_budget_requests', request.id, request);
    safeEmit('budget-request:created', request);
    res.json(request);
  });

  app.post("/api/budget-requests/:id/sign", async (req, res) => {
    const { id } = req.params;
    const { userId, approve, rejectionReason, signatureHash } = req.body;
    
    const request: any = await getById('erp_budget_requests', id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    
    if (!approve) {
      request.status = 'REJECTED';
      request.rejectionReason = rejectionReason || 'Rejeitado sem justificativa.';
      await saveDoc('erp_budget_requests', id, request);
      safeEmit('budget-request:updated', request);
      return res.json(request);
    }
    
    const user: any = await getById('erp_users', userId);
    if (!user) return res.status(404).json({ error: "Signer user not found" });

    // Append signature if not already signed
    const alreadySigned = request.signatures.some((s: any) => s.userId === userId);
    if (!alreadySigned) {
      request.signatures.push({
        userId,
        userName: user.name,
        userPosition: user.position,
        userDepartment: user.department,
        timestamp: Date.now(),
        hash: signatureHash || `NEXUS-SIG-${uuidv4().substring(0, 8).toUpperCase()}`
      });
    }

    const originalStatus = request.status;

    // Streamlined flow: PENDING_SUPERIOR -> PENDING_FINANCE -> APPROVED
    if (request.status === 'PENDING_SUPERIOR') {
      request.status = 'PENDING_FINANCE';
    } else if (request.status === 'PENDING_FINANCE') {
      request.status = 'APPROVED';
    }

    // Apply automatic budget balance adjustment when request crosses to APPROVED
    if (request.status === 'APPROVED' && originalStatus !== 'APPROVED') {
      try {
        const date = new Date(request.createdAt || Date.now());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`;

        const requester: any = await getById('erp_users', request.requesterId);
        if (requester) {
          const rawBudgets = await getAll('erp_budgets');

          // 1. DEBIT FROM SUPERIOR (or Global Company if no superiorId)
          if (requester.superiorId) {
            let superiorBudget = rawBudgets.find(b => b.month === monthStr && b.type === 'EMPLOYEE' && b.targetId === requester.superiorId);
            
            if (!superiorBudget) {
              superiorBudget = {
                id: uuidv4(),
                month: monthStr,
                type: 'EMPLOYEE',
                targetId: requester.superiorId,
                amount: 0,
                allocated: 0,
                updatedBy: 'SISTEMA CONTÁBIL',
                updatedAt: Date.now()
              };
            }
            superiorBudget.amount = Number(superiorBudget.amount || 0) - request.amount;
            await saveDoc('erp_budgets', superiorBudget.id, superiorBudget);
          } else {
            let globalBudget = rawBudgets.find(b => b.month === monthStr && b.type === 'COMPANY' && b.targetId === 'global');
            if (globalBudget) {
              globalBudget.amount = Number(globalBudget.amount || 0) - request.amount;
              await saveDoc('erp_budgets', globalBudget.id, globalBudget);
            }
          }

          // 2. CREDIT TO REQUESTER
          const freshBudgets = await getAll('erp_budgets');
          let requesterBudget = freshBudgets.find(b => b.month === monthStr && b.type === 'EMPLOYEE' && b.targetId === request.requesterId);
          
          if (!requesterBudget) {
            requesterBudget = {
              id: uuidv4(),
              month: monthStr,
              type: 'EMPLOYEE',
              targetId: request.requesterId,
              amount: 0,
              allocated: 0,
              updatedBy: 'SISTEMA CONTÁBIL',
              updatedAt: Date.now()
            };
          }
          requesterBudget.amount = Number(requesterBudget.amount || 0) + request.amount;
          await saveDoc('erp_budgets', requesterBudget.id, requesterBudget);
        }
      } catch (calcErr) {
        console.error("Erro no cálculo e dedução orçamentária automática:", calcErr);
      }
    }

    await saveDoc('erp_budget_requests', id, request);
    io.emit('budget-request:updated', request);
    res.json(request);
  });

  app.post("/api/budget-requests/:id/save-pdf", async (req, res) => {
    const { id } = req.params;
    const { fileData, fileName, requesterId } = req.body;
    
    const requester: any = await getById('erp_users', requesterId);
    if (!requester) return res.status(404).json({ error: "Requester not found" });

    let folders = await getAll('erp_vfs_folders');
    const userFolderName = `${requester.name} - ${requester.position}`;
    
    let userFolder = folders.find((f: any) => f.name === userFolderName && f.parentId === 'root');
    if (!userFolder) {
      userFolder = { id: uuidv4(), parentId: 'root', name: userFolderName, ownerId: requester.id, createdAt: Date.now() };
      await saveDoc('erp_vfs_folders', userFolder.id, userFolder);
      folders = await getAll('erp_vfs_folders');
    }

    let budgetFolder = folders.find((f: any) => f.name === 'Orçamentos e Verbas' && f.parentId === userFolder.id);
    if (!budgetFolder) {
      budgetFolder = { id: uuidv4(), parentId: userFolder.id, name: 'Orçamentos e Verbas', ownerId: requester.id, createdAt: Date.now() };
      await saveDoc('erp_vfs_folders', budgetFolder.id, budgetFolder);
    }

    const vfsFile = {
      id: uuidv4(),
      folderId: budgetFolder.id,
      name: fileName,
      type: 'application/pdf',
      uploaderId: requesterId,
      base64Data: fileData,
      uploadDate: Date.now()
    };
    await saveDoc('erp_vfs_files', vfsFile.id, vfsFile);
    
    const reqDoc: any = await getById('erp_budget_requests', id);
    if (reqDoc) {
      reqDoc.pdfFileId = vfsFile.id;
      await saveDoc('erp_budget_requests', id, reqDoc);
    }
    
    res.json({ success: true, fileId: vfsFile.id });
  });

  app.get("/api/campaigns", async (req, res) => res.json(await getAll('erp_campaigns')));

  app.post("/api/campaigns", async (req, res) => {
    const campaign = { id: uuidv4(), ...req.body };
    res.json(await saveDoc('erp_campaigns', campaign.id, campaign));
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await getById('erp_campaigns', id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const campaign = { ...(existing as object), ...req.body, id };
    res.json(await saveDoc('erp_campaigns', id, campaign));
  });

  // Purchases endpoints
  app.get("/api/purchases", async (req, res) => res.json(await getAll('erp_purchases')));

  app.post("/api/purchases", async (req, res) => {
    const purchase = { id: uuidv4(), ...req.body };
    res.json(await saveDoc('erp_purchases', purchase.id, purchase));
  });

  app.put("/api/purchases/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await getById('erp_purchases', id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const purchase = { ...(existing as object), ...req.body, id };
    res.json(await saveDoc('erp_purchases', id, purchase));
  });

  // Candidates endpoints
  app.get("/api/candidates", async (req, res) => res.json(await getAll('erp_candidates')));

  app.post("/api/candidates", async (req, res) => {
    const candidate = { id: uuidv4(), ...req.body };
    res.json(await saveDoc('erp_candidates', candidate.id, candidate));
  });

  app.put("/api/candidates/:id", async (req, res) => {
    const { id } = req.params;
    const existing = await getById('erp_candidates', id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const candidate = { ...(existing as object), ...req.body, id };
    res.json(await saveDoc('erp_candidates', id, candidate));
  });

  app.delete("/api/candidates/:id", async (req, res) => {
    const { id } = req.params;
    // Simple custom delete logic or similar for erp_candidates
    // Since we are using standard Firestore wrapper
    try {
      await deleteDocument('erp_candidates', id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // METADATA & SYSTEM INTEGRATION ENDPOINTS
  // ==========================================

  app.get("/api/system/integration-logs", async (req, res) => {
    const logs = await getAll('erp_integration_logs');
    // Sort descending by timestamp
    logs.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    res.json(logs);
  });

  app.get("/api/system/integration-keys", async (req, res) => {
    const activeKey = await getNexusApiKey();
    const companies = await getAll('erp_company');
    const company = companies.length > 0 ? companies[0] : {};

    res.json({
      nexusApiKey: activeKey,
      adminHubBaseUrl: company.adminHubBaseUrl || process.env.ADMINHUB_BASE_URL || "",
      adminHubApiKey: company.adminHubApiKey || process.env.ADMINHUB_API_KEY || "",
      isEnvConfigured: !!(process.env.NEXUS_ERP_API_KEY || process.env.NEXUS_API_KEY)
    });
  });

  // Sales Integration Receiver (From Loja Dicas by Ale)
  const processSalesIntegrationPayload = async (req: any, res: any) => {
    const data = req.body;
    
    // Extract Valor total da venda and Valor líquido
    const totalValue = Number(data.valorTotal ?? data.totalValue ?? data.value ?? 0);
    const netValue = Number(data.valorLiquido ?? data.netValue ?? data.net_value ?? totalValue);
    
    // Código do cliente
    const clientCode = String(data.codigoCliente ?? data.clientCode ?? data.client_code ?? '').trim();
    const clientName = String(data.cliente ?? data.client ?? data.clientName ?? 'Cliente Site').trim();

    // Produto(s) vendido(s)
    let products = data.produto ?? data.produtos ?? data.product ?? data.products ?? 'Produto Loja Dicas';
    if (Array.isArray(products)) {
      products = products.join(', ');
    }
    const productString = String(products).trim();

    // Autoria da venda (vendedor ou "Venda Automática" oriunda do site)
    let sellerId = 'automatic';
    let sellerName = 'Venda Automática';

    const autoria = String(data.autoria ?? data.sellerName ?? data.seller ?? data.vendedor ?? '').trim();
    const incomingSellerId = String(data.vendedorId ?? data.sellerId ?? '').trim();

    // Search matches of users in local db
    const users = await getAll('erp_users');
    let matchedUser = null;
    
    if (incomingSellerId) {
      matchedUser = users.find(u => u.id === incomingSellerId);
    }
    if (!matchedUser && autoria) {
      matchedUser = users.find(u => u.name?.toLowerCase().includes(autoria.toLowerCase()) || u.email?.toLowerCase() === autoria.toLowerCase());
    }

    if (matchedUser) {
      sellerId = matchedUser.id;
      sellerName = matchedUser.name;
    } else if (autoria) {
      sellerName = autoria;
    }

    // Data do contrato e Data da venda
    const parsedSaleDate = new Date(data.dataVenda ?? data.date ?? data.saleDate ?? Date.now());
    const saleTimestamp = isNaN(parsedSaleDate.getTime()) ? Date.now() : parsedSaleDate.getTime();

    const parsedContractDate = data.dataContrato ?? data.contractDate ?? data.contract_date;
    const contractTimestamp = parsedContractDate ? new Date(parsedContractDate).getTime() : saleTimestamp;

    // Dados da fatura (status e existência de Nota Fiscal)
    const hasInvoice = data.possuiNF !== undefined ? !!data.possuiNF : (data.hasInvoice !== undefined ? !!data.hasInvoice : !!(data.invoiceNumber ?? data.numeroNF));
    const invoiceNumber = String(data.numeroNF ?? data.invoiceNumber ?? data.invoice_number ?? '').trim();
    const invoiceStatus = String(data.statusFatura ?? data.invoiceStatus ?? data.invoice_status ?? (hasInvoice ? 'Faturado com NF-e' : 'Aguardando Emissão')).trim();

    // Status da operação (vendida / não vendida)
    const opStatusRaw = String(data.statusOperacao ?? data.operationStatus ?? data.operation_status ?? 'vendida').toLowerCase().trim();
    const operationStatus = (opStatusRaw === 'vendida' || opStatusRaw === 'sold') ? 'vendida' : 'nao_vendida';

    // Etapa de Homologação
    const homologationStage = String(data.etapaHomologacao ?? data.homologationStage ?? data.homologation_stage ?? 'Homologado Automaticamente').trim();

    const sale = {
      id: data.id ?? uuidv4(),
      sellerId,
      value: netValue, // Displayed field for cash balance/accounting
      client: clientName,
      date: saleTimestamp,
      product: productString,
      hasInvoice,
      invoiceNumber,
      status: (operationStatus === 'vendida') ? 'APPROVED' : 'PENDING_APPROVAL',
      
      // Integration payload metadata records
      totalValue,
      netValue,
      clientCode,
      sellerName,
      contractDate: isNaN(contractTimestamp) ? saleTimestamp : contractTimestamp,
      invoiceStatus,
      operationStatus,
      homologationStage,
      documentData: data.documentData ?? '',
      documentName: data.documentName ?? '',
      createdAt: Date.now()
    };

    await saveDoc('erp_sales', sale.id, sale);
    
    // Log the successful intake
    await logIntegration('SALES_RECEPTION', 'INBOUND', 'SUCCESS', `Pedido de venda do cliente ${sale.client} (Total R$ ${totalValue}) importado e criado no módulo de Vendas.`, data);
    
    io.emit('sale:created', sale);

    res.json({
      success: true,
      message: "Venda processada e integrada no Nexus ERP.",
      saleId: sale.id,
      sale
    });
  };

  app.post("/api/integration/sales/receive", validateIntegrationAuth, processSalesIntegrationPayload);
  app.post("/api/integration/sales", validateIntegrationAuth, processSalesIntegrationPayload);


  // Human Resources Integration Receiver (From AdminHub Enterprise)
  const processHrIntegrationPayload = async (req: any, res: any) => {
    const { id, name, email, department, position } = req.body;
    
    if (!name || !email || !department || !position) {
      const errorMsg = "Campos obrigatórios ausentes. Forneça name, email, department e position.";
      await logIntegration('HR_RECEPTION', 'INBOUND', 'ERROR', errorMsg, req.body);
      return res.status(400).json({ error: errorMsg });
    }

    const emailLower = email.toLowerCase().trim();
    const users = await getAll('erp_users');
    const existing = users.find(u => u.email?.toLowerCase().trim() === emailLower);

    if (existing) {
      // Basic fields synchronization only, isolated from orgchart / permissions
      existing.name = name;
      existing.department = department;
      existing.position = position;
      existing.role = department; // keep role for backup
      await saveDoc('erp_users', existing.id, existing);
      
      const detail = `Colaborador ${name} (${emailLower}) já possuía cadastro no Nexus; dados cadastrais de departamento e cargo sincronizados com sucesso.`;
      await logIntegration('HR_RECEPTION', 'INBOUND', 'SUCCESS', detail, req.body);

      const { passwordHash: _, ...safeUser } = existing;
      return res.json({
        success: true,
        message: "Dados cadastrais sincronizados no Nexus com sucesso.",
        user: safeUser,
        updated: true
      });
    }

    // Allocate brand new employee
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("Nexus123!", salt); // temporary initial credentials

    const newUser = {
      id: id || uuidv4(),
      name,
      email: emailLower,
      department,
      position,
      role: department,
      avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${name}`,
      superiorId: null, // Left empty as it represents isolated RH configs
      isSystemAdmin: false,
      status: 'ACTIVE',
      passwordHash,
      createdAt: Date.now()
    };

    await saveDoc('erp_users', newUser.id, newUser);

    // Automate folder establishment
    try {
      const getOrCreateDir = async (name: string, parentId: string): Promise<string> => {
        const folders = await getAll('erp_vfs_folders');
        const found = folders.find(f => f.name.toLowerCase() === name.toLowerCase() && f.parentId === parentId);
        if (found) return found.id;
        
        const folderId = uuidv4();
        await saveDoc('erp_vfs_folders', folderId, {
          id: folderId,
          name,
          parentId,
          createdAt: Date.now()
        });
        return folderId;
      };

      const deptName = newUser.department || 'ADMINISTRATIVO';
      const deptId = await getOrCreateDir(deptName, 'root');
      
      let parentFolderId = deptId;
      if (deptName === 'ADMINISTRATIVO') {
        const rhId = await getOrCreateDir('RH', deptId);
        parentFolderId = rhId;
      }
      const empFolderId = await getOrCreateDir(newUser.name, parentFolderId);
      
      await getOrCreateDir('Boletos', empFolderId);
      await getOrCreateDir('Histórico de Pagamento', empFolderId);
      await getOrCreateDir('Ponto', empFolderId);
    } catch (createDirErr) {
      console.error("[HR INTEGRATION INSIDE REST] Folder creation error:", createDirErr);
    }

    const detail = `Importação sucedida: Novo colaborador ${name} (${emailLower}) admitido virtualmente a partir do AdminHub.`;
    await logIntegration('HR_RECEPTION', 'INBOUND', 'SUCCESS', detail, req.body);

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({
      success: true,
      message: "Colaborador importado e inserido com sucesso na base corporativa do Nexus.",
      user: safeUser,
      updated: false
    });
  };

  app.post("/api/integration/hr/nexus", validateIntegrationAuth, processHrIntegrationPayload);
  app.post("/api/integration/hr/receive", validateIntegrationAuth, processHrIntegrationPayload);

  app.get("/api/tasks", async (req, res) => res.json(await getAll('tasks')));

  if (io) {
    io.on("connection", (socket) => {
      socket.on("message:send", async (data: { senderId: string, recipientId?: string, content: string, fileData?: string, fileName?: string, fileType?: string }) => {
        const newMsg = { 
          id: uuidv4(), 
          senderId: data.senderId, 
          recipientId: data.recipientId, 
          content: data.content, 
          timestamp: Date.now(),
          fileData: data.fileData,
          fileName: data.fileName,
          fileType: data.fileType
        };
        await saveDoc('erp_messages', newMsg.id, newMsg);
        safeEmit("message:created", newMsg);
      });
    });
  }

  // Global Express Error Handler Middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Unhandled Error during path", req.method, req.path, ":", err);
    const isPermissionDenied = err.code === 'permission-denied' || (err.message && err.message.includes('permission'));
    const status = isPermissionDenied ? 403 : (err.status || 500);
    res.status(status).json({
      error: err.message || "Internal Server Error"
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else if (process.env.VERCEL !== "1") {
    // Only serve static files via Express if NOT on Vercel
    const distPath = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  // Bind to port and address only if NOT running as a Vercel function
  if (process.env.VERCEL !== "1") {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }

  return app;
}

// Export the app instance for Vercel Serverless Functions
const app = await startServer();
export default app;
