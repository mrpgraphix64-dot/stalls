/**
 * TypeScript Interfaces for Reworkzone Stalls Operations Management
 */

export type EventStatus = 'upcoming' | 'in_progress' | 'live' | 'completed' | 'archived';

export type StallType = 'Wooden' | 'Frame' | 'Customize';

export type BoothStatus =
  | 'draft'
  | 'design'
  | 'approved'
  | 'in_production'
  | 'installed'
  | 'handover'
  | 'completed'
  | 'archived';

export interface EventItem {
  id: string;
  name: string;
  venue: string;
  city: string;
  start_date: string;
  end_date: string;
  setup_date?: string | null;
  dismantling_date?: string | null;
  status: EventStatus;
  notes?: string | null;
  floor_plan_url?: string | null;
  booth_count?: number;
  confirmed_booth_count?: number;
  discussion_booth_count?: number;
  created_at?: string;
  updated_at?: string;
  booths?: BoothItem[];
}

export interface BoothItem {
  id: string;
  event_id: string;
  booth_number: string;
  client_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  stand_size?: string;
  booth_type?: string;
  budget?: number;
  quoted_amount?: number;
  main_drive_folder_url?: string;
  design_responsibility?: 'Client Side' | 'Our Side' | string;
  print_file_status?: 'Designs Pending' | 'Partially Received' | 'All Files Ready' | string;
  print_drive_url?: string | null;
  print_remark?: string | null;
  goodies_status?: 'Awaiting Client Artwork' | 'Artwork Received' | 'Ready for Printing' | string;
  goodies_drive_url?: string | null;
  goodies_remark?: string | null;
  booking_stage?: 'confirmed' | 'discussion';
  discussion_remark?: string | null;
  wall_configuration?: '3 Sides' | 'Back + Left' | 'Back + Right' | 'Back Wall Only' | string | null;
  status: BoothStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Joined from event
  event_name?: string;
  event_venue?: string;
  event_city?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_setup_date?: string;
  event_dismantling_date?: string;
  event_floor_plan_url?: string | null;
  link_count?: number;
  task_count?: number;
  tasks_completed?: number;
  tasks_na?: number;
  tasks_total?: number;
  print_status?: 'done' | 'pending' | 'na' | string | null;
  prod_status?: 'done' | 'pending' | 'na' | string | null;
}

export interface ExhibitorItem {
  id: string;
  event_id?: string | null;
  company_name: string;
  official_id?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  city?: string | null;
  tagline?: string | null;
  booth_number?: string | null;
  booth_category?: string | null;
  notes?: string | null;
  source?: string;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  confirmed_stalls?: number;
  ongoing_discussions?: number;
  in_progress?: number;
  completed?: number;
  total_events: number;
  active_events: number;
  total_booths: number;
  completed_checklists?: number;
  booths_in_production: number;
  work_in_progress?: number;
  ready_completed?: number;
  pending_tasks: number;
  recent_booths: (BoothItem & {
    progress?: {
      total: number;
      applicable: number;
      completed: number;
      na?: number;
      percentage: number;
    };
  })[];
  all_booths?: (BoothItem & {
    progress?: {
      total: number;
      applicable: number;
      completed: number;
      na?: number;
      percentage: number;
    };
  })[];
  upcoming_events: (EventItem & { booth_count?: number })[];
}

export interface AuthStatus {
  is_initialized: boolean;
  authenticated: boolean;
  role: string | null;
  account_name: string | null;
  csrf_token: string | null;
  rate_limited?: boolean;
  retry_after?: number;
}

export type LinkCategory = 'render_3d' | 'working_artwork' | 'print_ready' | 'photo' | 'production' | 'other';

export type ItemCategory = 'furniture' | 'electrical' | 'production' | 'print' | 'av' | 'goodies' | 'promotional' | 'other';

export interface BoothLink {
  id: string;
  booth_id: string;
  category: LinkCategory;
  title: string;
  drive_url: string;
  version: string;
  is_final: number; // 0: Draft, 1: Approved
  approved_at?: string | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoothItemRecord {
  id: string;
  booth_id: string;
  category: ItemCategory;
  item_name: string;
  quantity: number;
  unit: string;
  specification?: string;
  vendor_name?: string;
  unit_cost?: number;
  total_cost?: number;
  is_delivered: number;
  is_installed: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoothTask {
  id: string;
  booth_id: string;
  phase: string;
  task_name: string;
  assigned_to?: string;
  completed_by?: string;
  is_completed: number;
  status?: 'pending' | 'completed' | 'not_applicable';
  completed_at?: string | null;
  due_date?: string | null;
  notes?: string;
  sort_order: number;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TasksSummary {
  success: boolean;
  total: number;
  applicable_count?: number;
  completed: number;
  na_count?: number;
  pending_count?: number;
  percentage: number;
  tasks: BoothTask[];
}

export type ExpenseCategory =
  | 'printing'
  | 'structure'
  | 'furniture'
  | 'electrical'
  | 'transport'
  | 'labor'
  | 'other';

export interface BoothExpense {
  id: string;
  booth_id: string;
  category: ExpenseCategory;
  description: string;
  estimated_cost: number;
  actual_cost: number;
  amount?: number;
  vendor_name?: string;
  paid_to?: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  is_paid?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExpensesSummary {
  success: boolean;
  total_estimated: number;
  total_actual: number;
  variance: number;
  expense_count: number;
  expenses: BoothExpense[];
}

export interface ActivityLog {
  id: string;
  booth_id?: string | null;
  action_type: string;
  actor_label: string;
  description: string;
  created_at: string;
}

export interface StallPrintData {
  booth: BoothItem;
  eventName: string;
  tasks: BoothTask[];
  productionItems: BoothItemRecord[];
  furnitureItems: BoothItemRecord[];
  electricalItems: BoothItemRecord[];
  goodiesItems: BoothItemRecord[];
  views3D?: BoothLink[];
}

