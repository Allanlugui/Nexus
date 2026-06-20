export type Department = string;
export type Position = string;
export type Role = Department; // Alias for backward compatibility if needed

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role; // Keeping for compatibility
  department: Department;
  position: Position;
  avatarUrl: string;
  superiorId: string | null;
  isSystemAdmin?: boolean;
  status?: 'ACTIVE' | 'DISMISSED';
  phone?: string;
  documentId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId?: string;
  content: string;
  timestamp: number;
  fileData?: string;
  fileName?: string;
  fileType?: string;
}

export interface ApprovalRequest {
  id: string;
  requesterId: string;
  title: string;
  description: string;
  amount: number;
  status: 'PENDING_DIRECTOR' | 'PENDING_FINANCE' | 'PENDING_DIRETORIA_GERAL' | 'PENDING_CEO' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  appealReason?: string;
  createdAt: number;
  signatures?: {
    userId: string;
    userName: string;
    userPosition: string;
    userDepartment: string;
    timestamp: number;
    hash: string;
  }[];
}

export interface DocumentInfo {
  id: string;
  uploaderId: string;
  name: string;
  size: number;
  type: string;
  uploadDate: number;
}

export interface VfsFolder {
  id: string;
  parentId: string | null;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface VfsFile {
  id: string;
  folderId: string;
  name: string;
  type: string;
  size?: number;
  uploaderId: string;
  base64Data?: string;
  uploadDate: number;
}

// New Module Interfaces
export interface Report {
  id: string;
  senderId: string;
  recipientId: string;
  title: string;
  content?: string;
  fileName?: string; // New field for uploaded doc
  fileData?: string; // Base64 data of the file
  date: number;
}

export interface Sale {
  id: string;
  sellerId: string;
  value: number;
  client: string;
  date: number;
  product: string;
  hasInvoice: boolean;
  invoiceNumber?: string;
  documentData?: string;
  documentName?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approvedBy?: string;

  // New integration-oriented fields
  totalValue?: number; // Valor total da venda
  netValue?: number; // Valor líquido de venda
  clientCode?: string; // Código do cliente
  sellerName?: string; // Autoria da venda (Venda Automática, etc.)
  contractDate?: number; // Data do contrato
  invoiceStatus?: string; // Status da fatura
  operationStatus?: 'vendida' | 'nao_vendida'; // Status da operação
  homologationStage?: string; // Etapa de homologação
}

export interface SalesTarget {
  departmentTotal: number;
  achieved: number;
  month: number; 
}

export interface Campaign {
  id: string;
  title: string;
  budget: number;
  spent: number;
  engagement: number;
  startDate: number;
  endDate: number;
  status: 'PLANNING' | 'ACTIVE' | 'FINISHED';
}

export interface Task {
  id: string;
  assigneeId: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'REVIEW' | 'DONE' | 'CANCELLED';
  dueDate: number;
  delegatorId?: string;
  description?: string;
  completionPhoto?: string;
  checklist?: { id: string; text: string; done: boolean }[];
  department?: string;
}

// New Budget Module Interfaces
export interface Budget {
  id: string;
  month: string; // e.g., "2026-05"
  type: 'COMPANY' | 'DEPARTMENT' | 'EMPLOYEE';
  targetId: string; // 'global' or 'FINANCEIRO', 'COMERCIAL', or employee userId
  amount: number;
  allocated: number;
  updatedBy: string;
  updatedAt: number;
}

export interface BudgetRequestSignature {
  userId: string;
  userName: string;
  userPosition: string;
  userDepartment: Department;
  timestamp: number;
  hash: string;
}

export interface BudgetRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  department: Department;
  projectName: string;
  amount: number;
  justification: string;
  createdAt: number;
  status: 'PENDING_SUPERIOR' | 'PENDING_FINANCE' | 'PENDING_FIN_SUPERIOR' | 'PENDING_FIN_DIR' | 'PENDING_GEN_DIR' | 'PENDING_CEO' | 'APPROVED' | 'REJECTED';
  signatures: BudgetRequestSignature[];
  rejectionReason?: string;
  pdfFileId?: string;
}

export interface Purchase {
  id: string;
  department: Department;
  requesterId: string;
  requesterName: string;
  item: string;
  value: number;
  status: 'PLANNING' | 'APPROVED' | 'REJECTED';
  subArea: string;
  date: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  department: Department;
  position: Position;
  salary: number;
  justification: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  createdAt: number;
}

