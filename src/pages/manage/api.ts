/**
 * API Client for Reworkzone Stalls Operations System
 * Handles session cookies, CSRF tokens, and error parsing.
 */

import {
  AuthStatus,
  DashboardData,
  EventItem,
  BoothItem,
  BoothLink,
  BoothItemRecord,
  BoothTask,
  TasksSummary,
  BoothExpense,
  ExpensesSummary,
  ActivityLog,
  ExhibitorItem,
  StallPrintData,
} from './types';

let cachedCsrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return cachedCsrfToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (cachedCsrfToken && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
    headers['X-CSRF-Token'] = cachedCsrfToken;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Server returned error HTTP ${response.status}`;
    const err = new Error(errorMsg) as Error & { status: number; data: any };
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

// -------------------------------------------------------------
// Authentication API
// -------------------------------------------------------------
export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await request<AuthStatus & { success: boolean }>('/manage/api/auth.php?action=status');
  if (res.csrf_token) {
    setCsrfToken(res.csrf_token);
  }
  return res;
}

export async function loginWithPin(pin: string): Promise<{ success: boolean; role: string; csrf_token: string; account_name: string }> {
  const res = await request<{ success: boolean; role: string; csrf_token: string; account_name: string }>('/manage/api/auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  if (res.csrf_token) {
    setCsrfToken(res.csrf_token);
  }
  return res;
}

export async function logout(): Promise<void> {
  await request('/manage/api/auth.php?action=logout', { method: 'POST' });
  setCsrfToken(null);
}

export async function changePin(currentPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/manage/api/change-pin.php', {
    method: 'POST',
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  });
}

// -------------------------------------------------------------
// Dashboard API
// -------------------------------------------------------------
export async function fetchDashboard(): Promise<DashboardData> {
  const res = await request<{ success: boolean; data: DashboardData }>('/manage/api/dashboard.php');
  return res.data;
}

// -------------------------------------------------------------
// Events API
// -------------------------------------------------------------
export async function fetchEvents(params?: { search?: string; status?: string }): Promise<EventItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);

  const res = await request<{ success: boolean; events: EventItem[] }>(`/manage/api/events.php?${query.toString()}`);
  return res.events;
}

export async function fetchEvent(id: string): Promise<EventItem> {
  const res = await request<{ success: boolean; event: EventItem }>(`/manage/api/events.php?id=${encodeURIComponent(id)}`);
  return res.event;
}

export async function createEvent(eventData: Partial<EventItem>): Promise<EventItem> {
  const res = await request<{ success: boolean; event: EventItem }>('/manage/api/events.php?action=create', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  return res.event;
}

export async function updateEvent(id: string, eventData: Partial<EventItem>): Promise<EventItem> {
  const res = await request<{ success: boolean; event: EventItem }>('/manage/api/events.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...eventData, id }),
  });
  return res.event;
}

export async function archiveEvent(id: string): Promise<void> {
  await request('/manage/api/events.php?action=archive', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await request(`/manage/api/events.php?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchEventChecklistsPrintData(
  eventId: string,
  boothIds?: string[],
  includeDiscussions?: boolean
): Promise<{ success: boolean; event: EventItem; stalls: StallPrintData[]; count: number }> {
  const query = new URLSearchParams({ id: eventId, action: 'print_checklists' });
  if (boothIds && boothIds.length > 0) {
    query.set('booth_ids', boothIds.join(','));
  }
  if (includeDiscussions) {
    query.set('include_discussions', '1');
  }
  return request<{ success: boolean; event: EventItem; stalls: StallPrintData[]; count: number }>(
    `/manage/api/events.php?${query.toString()}`
  );
}

export async function fetchBoothsChecklistsPrintData(
  boothIds?: string[],
  eventId?: string,
  includeDiscussions?: boolean
): Promise<{ success: boolean; stalls: StallPrintData[]; count: number }> {
  const query = new URLSearchParams({ action: 'print_checklists' });
  if (boothIds && boothIds.length > 0) {
    query.set('booth_ids', boothIds.join(','));
  }
  if (eventId) {
    query.set('event_id', eventId);
  }
  if (includeDiscussions) {
    query.set('include_discussions', '1');
  }
  return request<{ success: boolean; stalls: StallPrintData[]; count: number }>(
    `/manage/api/booths.php?${query.toString()}`
  );
}

// -------------------------------------------------------------
// Booths API
// -------------------------------------------------------------
export async function fetchBooths(params?: { event_id?: string; status?: string; search?: string; booking_stage?: string }): Promise<BoothItem[]> {
  const query = new URLSearchParams();
  if (params?.event_id) query.set('event_id', params.event_id);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.booking_stage) query.set('booking_stage', params.booking_stage);

  const res = await request<{ success: boolean; booths: BoothItem[] }>(`/manage/api/booths.php?${query.toString()}`);
  return res.booths;
}

export async function fetchBooth(id: string): Promise<BoothItem> {
  const res = await request<{ success: boolean; booth: BoothItem }>(`/manage/api/booths.php?id=${encodeURIComponent(id)}`);
  return res.booth;
}

export async function createBooth(boothData: Partial<BoothItem>): Promise<BoothItem> {
  const res = await request<{ success: boolean; booth: BoothItem }>('/manage/api/booths.php?action=create', {
    method: 'POST',
    body: JSON.stringify(boothData),
  });
  return res.booth;
}

export async function updateBooth(id: string, boothData: Partial<BoothItem>): Promise<BoothItem> {
  const res = await request<{ success: boolean; booth: BoothItem }>('/manage/api/booths.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...boothData, id }),
  });
  return res.booth;
}

export async function confirmBooth(id: string, boothNumber: string): Promise<BoothItem> {
  const res = await request<{ success: boolean; message: string; booth: BoothItem }>('/manage/api/booths.php?action=confirm', {
    method: 'POST',
    body: JSON.stringify({ id, booth_number: boothNumber }),
  });
  return res.booth;
}

export async function archiveBooth(id: string): Promise<void> {
  await request('/manage/api/booths.php?action=archive', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function deleteBooth(id: string): Promise<void> {
  await request(`/manage/api/booths.php?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Google Drive Links API
// -------------------------------------------------------------
export async function fetchLinks(boothId: string, category?: string): Promise<BoothLink[]> {
  const query = new URLSearchParams({ booth_id: boothId });
  if (category && category !== 'all') query.set('category', category);

  const res = await request<{ success: boolean; links: BoothLink[] }>(`/manage/api/links.php?${query.toString()}`);
  return res.links;
}

export async function createLink(linkData: Partial<BoothLink>): Promise<BoothLink> {
  const res = await request<{ success: boolean; link: BoothLink }>('/manage/api/links.php?action=create', {
    method: 'POST',
    body: JSON.stringify(linkData),
  });
  return res.link;
}

export async function updateLink(id: string, linkData: Partial<BoothLink>): Promise<BoothLink> {
  const res = await request<{ success: boolean; link: BoothLink }>('/manage/api/links.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...linkData, id }),
  });
  return res.link;
}

export async function approveLink(id: string): Promise<BoothLink> {
  const res = await request<{ success: boolean; link: BoothLink }>('/manage/api/links.php?action=approve', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  return res.link;
}

export async function unapproveLink(id: string): Promise<BoothLink> {
  const res = await request<{ success: boolean; link: BoothLink }>('/manage/api/links.php?action=unapprove', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  return res.link;
}

export async function deleteLink(id: string): Promise<void> {
  await request('/manage/api/links.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function uploadPreviewImage(file: File): Promise<{ preview_image_url: string; filename: string }> {
  const formData = new FormData();
  formData.append('preview_image', file);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (cachedCsrfToken) {
    headers['X-CSRF-Token'] = cachedCsrfToken;
  }

  const response = await fetch('/manage/api/links.php?action=upload_preview', {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload preview image.');
  }

  return { preview_image_url: data.preview_image_url, filename: data.filename };
}

// -------------------------------------------------------------
// Booth Items API (Furniture, Electrical, Production, Print)
// -------------------------------------------------------------
export async function fetchItems(boothId: string, category?: string): Promise<BoothItemRecord[]> {
  const query = new URLSearchParams({ booth_id: boothId });
  if (category && category !== 'all') query.set('category', category);

  const res = await request<{ success: boolean; items: BoothItemRecord[] }>(`/manage/api/items.php?${query.toString()}`);
  return res.items;
}

export async function createItem(itemData: Partial<BoothItemRecord>): Promise<BoothItemRecord> {
  const res = await request<{ success: boolean; item: BoothItemRecord }>('/manage/api/items.php?action=create', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
  return res.item;
}

export async function updateItem(id: string, itemData: Partial<BoothItemRecord>): Promise<BoothItemRecord> {
  const res = await request<{ success: boolean; item: BoothItemRecord }>('/manage/api/items.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...itemData, id }),
  });
  return res.item;
}

export async function toggleItemStatus(id: string, field: 'is_delivered' | 'is_installed'): Promise<BoothItemRecord> {
  const res = await request<{ success: boolean; item: BoothItemRecord }>('/manage/api/items.php?action=toggle_status', {
    method: 'POST',
    body: JSON.stringify({ id, field }),
  });
  return res.item;
}

export async function deleteItem(id: string): Promise<void> {
  await request('/manage/api/items.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// -------------------------------------------------------------
// Exhibitors Catalogue API
// -------------------------------------------------------------
export async function fetchExhibitors(params?: {
  search?: string;
  event_id?: string;
  limit?: number;
}): Promise<ExhibitorItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.event_id) query.set('event_id', params.event_id);
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await request<{ success: boolean; exhibitors: ExhibitorItem[] }>(
    `/manage/api/exhibitors.php${qs ? `?${qs}` : ''}`
  );
  return res.exhibitors || [];
}

export async function createExhibitor(
  data: Partial<ExhibitorItem>
): Promise<{ success: boolean; exhibitor: ExhibitorItem; is_existing?: boolean }> {
  return request<{ success: boolean; exhibitor: ExhibitorItem; is_existing?: boolean }>(
    '/manage/api/exhibitors.php?action=create',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export async function updateExhibitor(
  id: string,
  data: Partial<ExhibitorItem>
): Promise<{ success: boolean; exhibitor: ExhibitorItem }> {
  return request<{ success: boolean; exhibitor: ExhibitorItem }>(
    '/manage/api/exhibitors.php?action=update',
    {
      method: 'POST',
      body: JSON.stringify({ ...data, id }),
    }
  );
}

// -------------------------------------------------------------
// Booth Tasks / Checklist API
// -------------------------------------------------------------
export async function fetchTasks(boothId: string): Promise<TasksSummary> {
  return request<TasksSummary>(`/manage/api/tasks.php?booth_id=${encodeURIComponent(boothId)}`);
}

export async function toggleTask(id: string): Promise<{
  success: boolean;
  task: BoothTask;
  total: number;
  applicable_count?: number;
  completed: number;
  na_count?: number;
  pending_count?: number;
  percentage: number;
}> {
  return request('/manage/api/tasks.php?action=toggle', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function setTaskStatus(
  id: string,
  status: 'pending' | 'completed' | 'not_applicable'
): Promise<{
  success: boolean;
  task: BoothTask;
  total: number;
  applicable_count?: number;
  completed: number;
  na_count?: number;
  pending_count?: number;
  percentage: number;
}> {
  return request('/manage/api/tasks.php?action=set_status', {
    method: 'POST',
    body: JSON.stringify({ id, status }),
  });
}

export async function createTask(taskData: Partial<BoothTask>): Promise<BoothTask> {
  const res = await request<{ success: boolean; task: BoothTask }>('/manage/api/tasks.php?action=create', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
  return res.task;
}

export async function updateTask(id: string, taskData: Partial<BoothTask>): Promise<BoothTask> {
  const res = await request<{ success: boolean; task: BoothTask }>('/manage/api/tasks.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...taskData, id }),
  });
  return res.task;
}

export async function deleteTask(id: string): Promise<void> {
  await request('/manage/api/tasks.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// -------------------------------------------------------------
// Booth Costing & Expenses API
// -------------------------------------------------------------
export async function fetchExpenses(boothId: string): Promise<ExpensesSummary> {
  return request<ExpensesSummary>(`/manage/api/expenses.php?booth_id=${encodeURIComponent(boothId)}`);
}

export async function createExpense(expData: Partial<BoothExpense>): Promise<BoothExpense> {
  const res = await request<{ success: boolean; expense: BoothExpense }>('/manage/api/expenses.php?action=create', {
    method: 'POST',
    body: JSON.stringify(expData),
  });
  return res.expense;
}

export async function updateExpense(id: string, expData: Partial<BoothExpense>): Promise<BoothExpense> {
  const res = await request<{ success: boolean; expense: BoothExpense }>('/manage/api/expenses.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ ...expData, id }),
  });
  return res.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await request('/manage/api/expenses.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// -------------------------------------------------------------
// Activity Logs API
// -------------------------------------------------------------
export async function fetchLogs(boothId?: string): Promise<ActivityLog[]> {
  const query = boothId ? `?booth_id=${encodeURIComponent(boothId)}` : '';
  const res = await request<{ success: boolean; logs: ActivityLog[] }>(`/manage/api/logs.php${query}`);
  return res.logs;
}

// -------------------------------------------------------------
// Backups & Maintenance API
// -------------------------------------------------------------
export async function verifyDatabaseBackup(): Promise<any> {
  return request<any>('/manage/api/backup.php?action=verify');
}

export async function createDatabaseSnapshot(): Promise<{ success: boolean; message: string; filename?: string }> {
  return request<{ success: boolean; message: string; filename?: string }>('/manage/api/backup.php?action=create_snapshot', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
