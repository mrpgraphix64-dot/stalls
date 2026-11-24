import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Building,
  Phone,
  Edit2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Palette,
  Printer,
  Hammer,
  Armchair,
  Zap,
  ExternalLink,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Layers,
  Archive,
  FileText,
  Tv,
  Box,
  Folder,
  MessageSquare,
  Save,
  Share2,
  Upload,
  Image as ImageIcon,
  Eye,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import {
  fetchBooth,
  updateBooth,
  updateEvent,
  archiveBooth,
  deleteBooth,
  confirmBooth,
  fetchTasks,
  setTaskStatus,
  fetchItems,
  createItem,
  deleteItem,
  updateItem,
  fetchLinks,
  createLink,
  updateLink,
  deleteLink,
  uploadPreviewImage,
} from './api';
import { BoothItem, BoothTask, BoothItemRecord, StallType, BoothLink } from './types';
import { Modal } from './Modal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { getBoothOrigin } from './scrollRestoration';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { PrintChecklistModal } from './PrintChecklistModal';
import { ShareStallModal } from './ShareStallModal';
import { EditBoothModal } from './EditBoothModal';
import { isPendingOrEmpty } from './boothSort';

interface ChecklistProgress {
  total: number;
  applicable_count: number;
  completed: number;
  na_count?: number;
  pending_count?: number;
  percentage: number;
}

interface BoothDetailViewProps {
  boothId: string;
  onNavigate: (route: string) => void;
}

const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (2 × 2 m)',
  'Custom Size',
];

export function BoothDetailView({ boothId, onNavigate }: BoothDetailViewProps) {
  const [booth, setBooth] = useState<BoothItem | null>(null);
  const [tasks, setTasks] = useState<BoothTask[]>([]);
  const [tasksSummary, setTasksSummary] = useState<ChecklistProgress>({
    total: 5,
    applicable_count: 5,
    completed: 0,
    na_count: 0,
    pending_count: 5,
    percentage: 0,
  });

  // Dynamic checklist counts directly from tasks state
  const checklistCounts = useMemo(() => {
    const applicableTasks = tasks.filter((t) => t.status !== 'not_applicable');
    const doneTasks = applicableTasks.filter((t) => t.status === 'completed' || t.is_completed === 1);
    const naTasks = tasks.filter((t) => t.status === 'not_applicable');
    const pendingTasks = applicableTasks.filter((t) => t.status !== 'completed' && t.is_completed !== 1);

    const total = tasks.length;
    const applicable = applicableTasks.length;
    const done = doneTasks.length;
    const na = naTasks.length;
    const pending = pendingTasks.length;
    const percentage = applicable > 0 ? Math.round((done / applicable) * 100) : 0;

    return {
      total,
      applicable,
      done,
      na,
      pending,
      percentage,
    };
  }, [tasks]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');
  const [errorToast, setErrorToast] = useState<string>('');

  // Confirm Stall State (when viewing an Ongoing Discussion)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [confirmStallNumber, setConfirmStallNumber] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');
  const [confirmSubmitting, setConfirmSubmitting] = useState<boolean>(false);

  // Expandable sections state
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    print: true,
    production: true,
    furniture: true,
    electrical: true,
  });
  const initialAccordionBoothIdRef = React.useRef<string | null>(null);

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Section 1: Design State & 3D Stall Views
  const [designResp, setDesignResp] = useState<'Client Side' | 'Our Side'>('Client Side');
  const [isSavingDesign, setIsSavingDesign] = useState<boolean>(false);
  const [views3D, setViews3D] = useState<BoothLink[]>([]);
  const [showAdd3DForm, setShowAdd3DForm] = useState<boolean>(false);
  const [title3D, setTitle3D] = useState<string>('');
  const [url3D, setUrl3D] = useState<string>('');
  const [previewImg3D, setPreviewImg3D] = useState<string>('');
  const [isUploading3DImg, setIsUploading3DImg] = useState<boolean>(false);
  const [isFinal3D, setIsFinal3D] = useState<boolean>(false);
  const [note3D, setNote3D] = useState<string>('');
  const [isSaving3D, setIsSaving3D] = useState<boolean>(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editTitle3D, setEditTitle3D] = useState<string>('');
  const [editUrl3D, setEditUrl3D] = useState<string>('');
  const [editPreviewImg3D, setEditPreviewImg3D] = useState<string>('');
  const [isEditingUploading3DImg, setIsEditingUploading3DImg] = useState<boolean>(false);
  const [editIsFinal3D, setEditIsFinal3D] = useState<boolean>(false);
  const [editNote3D, setEditNote3D] = useState<string>('');
  const [isUpdating3D, setIsUpdating3D] = useState<boolean>(false);
  const [add3DError, setAdd3DError] = useState<string>('');
  const [edit3DError, setEdit3DError] = useState<string>('');
  const [editHasRemovedImg3D, setEditHasRemovedImg3D] = useState<boolean>(false);
  const [is3DMenuOpen, setIs3DMenuOpen] = useState<boolean>(false);
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; title: string } | null>(null);
  const [modalImgError, setModalImgError] = useState<boolean>(false);
  const [modalImgRetryKey, setModalImgRetryKey] = useState<number>(0);
  const [brokenThumbnails, setBrokenThumbnails] = useState<Set<string>>(new Set());

  // Close 3D preview lightbox on Escape key
  useEffect(() => {
    if (!previewModalImg) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewModalImg(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModalImg]);

  // Fast resolution for 3D Stall Views & Print Files quick shortcuts
  const valid3DViews = useMemo(() => {
    return (views3D || []).filter(
      (v) =>
        (v.drive_url && (v.drive_url.trim().startsWith('https://') || v.drive_url.trim().startsWith('http://'))) ||
        (v.preview_image_url && v.preview_image_url.trim().length > 0)
    );
  }, [views3D]);

  const primary3DView = useMemo(() => {
    if (valid3DViews.length === 0) return null;
    return valid3DViews.find((v) => v.is_final === 1) || valid3DViews[0];
  }, [valid3DViews]);

  const primary3DTarget = useMemo(() => {
    if (!primary3DView) return null;
    const drive = (primary3DView.drive_url || '').trim();
    if (drive.startsWith('https://') || drive.startsWith('http://')) {
      return drive;
    }
    const img = (primary3DView.preview_image_url || '').trim();
    if (img.startsWith('/') || img.startsWith('https://') || img.startsWith('http://')) {
      return img;
    }
    return null;
  }, [primary3DView]);

  // Section 2: Print Files State
  const [printStatus, setPrintStatus] = useState<string>('Designs Pending');
  const [printInputUrl, setPrintInputUrl] = useState<string>('');
  const [printRemark, setPrintRemark] = useState<string>('');
  const [isSavingPrint, setIsSavingPrint] = useState<boolean>(false);
  const [isEditingPrintUrl, setIsEditingPrintUrl] = useState<boolean>(false);
  const [printError, setPrintError] = useState<string>('');

  const savedPrintUrl = useMemo(() => {
    const url = (booth?.print_drive_url || booth?.resolved_print_drive_url || '').trim();
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      return url;
    }
    return null;
  }, [booth?.print_drive_url, booth?.resolved_print_drive_url]);

  const hasSavedPrintUrl = Boolean(savedPrintUrl);
  const validPrintFilesUrl = savedPrintUrl;

  // Goodies & Promotional Printing State (inside Section 2)
  const [goodiesItems, setGoodiesItems] = useState<BoothItemRecord[]>([]);
  const [goodiesStatus, setGoodiesStatus] = useState<string>('Awaiting Client Artwork');
  const [goodiesInputUrl, setGoodiesInputUrl] = useState<string>('');
  const [goodiesRemark, setGoodiesRemark] = useState<string>('');
  const [isSavingGoodiesArtwork, setIsSavingGoodiesArtwork] = useState<boolean>(false);
  const [isEditingGoodiesUrl, setIsEditingGoodiesUrl] = useState<boolean>(false);
  const [goodiesError, setGoodiesError] = useState<string>('');

  const savedGoodiesUrl = useMemo(() => {
    const url = (booth?.goodies_drive_url || '').trim();
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      return url;
    }
    return null;
  }, [booth?.goodies_drive_url]);

  const hasSavedGoodiesUrl = Boolean(savedGoodiesUrl);
  const [goodiesNameInput, setGoodiesNameInput] = useState<string>('');
  const [goodiesSpecInput, setGoodiesSpecInput] = useState<string>('');
  const [goodiesQtyStr, setGoodiesQtyStr] = useState<string>('1');
  const [showCustomGoodiesForm, setShowCustomGoodiesForm] = useState<boolean>(false);

  // Section 3: Production State
  const [prodItems, setProdItems] = useState<BoothItemRecord[]>([]);
  const [prodNameInput, setProdNameInput] = useState<string>('');
  const [prodSpecInput, setProdSpecInput] = useState<string>('');
  const [prodQtyStr, setProdQtyStr] = useState<string>('1');
  const [isSavingWallConfig, setIsSavingWallConfig] = useState<boolean>(false);

  // Special Quick Add Panels in Production
  const [activeSpecialPanel, setActiveSpecialPanel] = useState<'none' | 'flooring' | 'tv'>('none');
  const [carpetColor, setCarpetColor] = useState<'Grey' | 'Red' | 'Blue'>('Grey');
  const [tvSize, setTvSize] = useState<'42 inch' | '50–55 inch'>('50–55 inch');
  const [tvMounting, setTvMounting] = useState<'Wall Mounted (Without Stand)' | 'With Stand'>('Wall Mounted (Without Stand)');
  const [tvQtyStr, setTvQtyStr] = useState<string>('1');

  // Delete confirmation for Flooring with Carpet
  const [flooringDeletePrompt, setFlooringDeletePrompt] = useState<{
    flooringItem: BoothItemRecord;
    carpetItem: BoothItemRecord | null;
  } | null>(null);

  // Section 4: Furniture State
  const [furnItems, setFurnItems] = useState<BoothItemRecord[]>([]);
  const [furnNameInput, setFurnNameInput] = useState<string>('');
  const [furnQtyStr, setFurnQtyStr] = useState<string>('1');

  // Section 5: Electrical State
  const [elecItems, setElecItems] = useState<BoothItemRecord[]>([]);
  const [elecNameInput, setElecNameInput] = useState<string>('');
  const [elecQtyStr, setElecQtyStr] = useState<string>('1');

  // Inline Item Editing State (for Furniture, Electrical, Production)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState<string>('');
  const [editItemSpec, setEditItemSpec] = useState<string>('');
  const [editItemQtyStr, setEditItemQtyStr] = useState<string>('1');
  const [editItemUnit, setEditItemUnit] = useState<string>('nos');
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);

  // Edit Booth Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [editBoothNumber, setEditBoothNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');
  const [editStructure, setEditStructure] = useState<StallType>('Wooden');
  const [editDiscussionRemark, setEditDiscussionRemark] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // Helper to map stall type
  const getStallTypeLabel = (rawType?: string): StallType => {
    const raw = (rawType || '').toLowerCase();
    if (raw.includes('frame') || raw.includes('octonorm')) return 'Frame';
    if (raw.includes('custom')) return 'Customize';
    return 'Wooden';
  };

  // Helper to merge booth state preserving canonical links
  const mergeBoothCanonical = (prev: BoothItem | null, updated: BoothItem): BoothItem => {
    const printUrl = (updated.print_drive_url || updated.resolved_print_drive_url || prev?.print_drive_url || prev?.resolved_print_drive_url || '').trim() || null;
    return {
      ...updated,
      print_drive_url: printUrl,
      resolved_print_drive_url: printUrl,
      primary_3d_url: updated.primary_3d_url || prev?.primary_3d_url || null,
      primary_3d_preview_url: updated.primary_3d_preview_url || prev?.primary_3d_preview_url || null,
    };
  };

  // Load booth data and section items
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');
      const [bth, tskRes, pItems, fItems, eItems, gItems, d3dViews] = await Promise.all([
        fetchBooth(boothId),
        fetchTasks(boothId),
        fetchItems(boothId, 'production').catch(() => []),
        fetchItems(boothId, 'furniture').catch(() => []),
        fetchItems(boothId, 'electrical').catch(() => []),
        fetchItems(boothId, 'goodies').catch(() => []),
        fetchLinks(boothId, 'render_3d').catch(() => []),
      ]);

      const canonicalPrintUrl = (
        bth.print_drive_url ||
        bth.resolved_print_drive_url ||
        ''
      ).trim();
      const canonicalBooth = {
        ...bth,
        print_drive_url: canonicalPrintUrl || null,
        resolved_print_drive_url: canonicalPrintUrl || null,
      };
      setBooth(canonicalBooth);
      setDesignResp(bth.design_responsibility === 'Our Side' ? 'Our Side' : 'Client Side');
      setViews3D(d3dViews || []);
      setPrintStatus(bth.print_file_status || 'Designs Pending');
      setPrintInputUrl(canonicalPrintUrl);
      setPrintRemark(bth.print_remark || '');
      setIsEditingPrintUrl(false);
      setPrintError('');

      setGoodiesStatus(bth.goodies_status || 'Awaiting Client Artwork');
      setGoodiesInputUrl(bth.goodies_drive_url || '');
      setGoodiesRemark(bth.goodies_remark || '');
      setIsEditingGoodiesUrl(false);
      setGoodiesError('');
      setGoodiesItems(gItems);

      setTasks(tskRes.tasks);
      setTasksSummary({
        total: tskRes.total,
        applicable_count: tskRes.applicable_count ?? tskRes.total,
        completed: tskRes.completed,
        na_count: tskRes.na_count ?? 0,
        pending_count: tskRes.pending_count ?? 0,
        percentage: tskRes.percentage,
      });

      setProdItems(pItems);
      setFurnItems(fItems);
      setElecItems(eItems);

      // Auto-expand unfinished checklist sections on initial stall load
      // Pending -> Expanded; Completed or N/A -> Collapsed
      if (initialAccordionBoothIdRef.current !== boothId) {
        initialAccordionBoothIdRef.current = boothId;
        const sectionKeys = ['print', 'production', 'furniture', 'electrical'];
        const autoExpanded: { [key: string]: boolean } = {};
        sectionKeys.forEach((secKey) => {
          const key = secKey.toLowerCase();
          const task = (tskRes.tasks || []).find((t) => {
            const name = t.task_name.toLowerCase();
            if (key === 'print') return name.includes('print');
            if (key === 'production') return name.includes('production') || name.includes('structure');
            if (key === 'furniture') return name.includes('furniture');
            if (key === 'electrical') return name.includes('electrical');
            return false;
          });
          if (!task) {
            autoExpanded[secKey] = true;
          } else {
            const st = task.status || (task.is_completed ? 'completed' : 'pending');
            const isDone = st === 'completed';
            const isNA = st === 'not_applicable' || (st as string) === 'na';
            autoExpanded[secKey] = !(isDone || isNA);
          }
        });
        setExpanded(autoExpanded);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load booth information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [boothId]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const showErrorToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 4000);
  };

  // Find task matching section key
  const getTaskForSection = (sectionKey: string): BoothTask | undefined => {
    const key = sectionKey.toLowerCase();
    return tasks.find((t) => {
      const name = t.task_name.toLowerCase();
      if (key === 'print') return name.includes('print');
      if (key === 'production') return name.includes('production') || name.includes('structure');
      if (key === 'furniture') return name.includes('furniture');
      if (key === 'electrical') return name.includes('electrical');
      return false;
    });
  };

  // Handle task status change (toggle completed or not_applicable)
  const handleToggleTaskStatus = async (sectionKey: string, targetStatus?: 'pending' | 'completed' | 'not_applicable') => {
    const task = getTaskForSection(sectionKey);
    if (!task) return;

    let newStatus: 'pending' | 'completed' | 'not_applicable' = 'completed';
    const currentStatus = task.status || (task.is_completed ? 'completed' : 'pending');

    if (targetStatus) {
      newStatus = targetStatus;
    } else {
      if (currentStatus === 'completed') {
        newStatus = 'pending';
      } else {
        newStatus = 'completed';
      }
    }

    try {
      const res = await setTaskStatus(task.id, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, is_completed: newStatus === 'completed' ? 1 : 0 } : t))
      );

      // If marked as Not Required (N/A), collapse the section by default
      if (newStatus === 'not_applicable') {
        setExpanded((prev) => ({ ...prev, [sectionKey]: false }));
      }

      setTasksSummary({
        total: res.total,
        applicable_count: res.applicable_count ?? res.total,
        completed: res.completed,
        na_count: res.na_count ?? 0,
        pending_count: res.pending_count ?? 0,
        percentage: res.percentage,
      });
      showToast(`${sectionKey.toUpperCase()}: Marked as ${newStatus === 'not_applicable' ? 'Not Required' : newStatus === 'completed' ? 'Done' : 'Pending'}`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update task status.');
    }
  };

  // 1. Design Section Handlers
  const handleSetDesignResponsibility = async (val: 'Client Side' | 'Our Side') => {
    setDesignResp(val);
    setIsSavingDesign(true);
    try {
      const updated = await updateBooth(boothId, { design_responsibility: val });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      showToast(`Design Responsibility set to: ${val}`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update design responsibility.');
    } finally {
      setIsSavingDesign(false);
    }
  };

  // 1B. 3D View of Stall Handlers
  const handleUpload3DImage = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      const msg = 'Image file size must be less than 10MB.';
      if (isEditMode) setEdit3DError(msg); else setAdd3DError(msg);
      showErrorToast(msg);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      const msg = 'Please upload a JPG, PNG, or WebP image.';
      if (isEditMode) setEdit3DError(msg); else setAdd3DError(msg);
      showErrorToast(msg);
      return;
    }

    if (isEditMode) {
      setIsEditingUploading3DImg(true);
      setEdit3DError('');
    } else {
      setIsUploading3DImg(true);
      setAdd3DError('');
    }

    try {
      const res = await uploadPreviewImage(file);
      if (isEditMode) {
        setEditPreviewImg3D(res.preview_image_url);
        setEditHasRemovedImg3D(false);
        setEdit3DError('');
      } else {
        setPreviewImg3D(res.preview_image_url);
        setAdd3DError('');
      }
      showToast('3D preview image uploaded successfully!');
    } catch (err: any) {
      const msg = err.message || 'Failed to upload preview image.';
      if (isEditMode) setEdit3DError(msg); else setAdd3DError(msg);
      showErrorToast(msg);
    } finally {
      if (isEditMode) {
        setIsEditingUploading3DImg(false);
      } else {
        setIsUploading3DImg(false);
      }
      e.target.value = '';
    }
  };

  const handleAdd3DView = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdd3DError('');
    const title = title3D.trim();
    const url = url3D.trim();
    const note = note3D.trim();
    const previewImg = previewImg3D.trim();

    if (!title) {
      const msg = 'Please enter a 3D view title (e.g. Front View, Perspective View).';
      setAdd3DError(msg);
      showErrorToast(msg);
      return;
    }
    if (!url && !previewImg) {
      const msg = 'Please add a 3D image or a 3D view link.';
      setAdd3DError(msg);
      showErrorToast(msg);
      return;
    }
    if (url && (!url.startsWith('http://') && !url.startsWith('https://'))) {
      const msg = 'Please enter a valid web URL starting with https:// or http://';
      setAdd3DError(msg);
      showErrorToast(msg);
      return;
    }

    setIsSaving3D(true);
    try {
      const created = await createLink({
        booth_id: boothId,
        category: 'render_3d',
        title,
        drive_url: url || '',
        preview_image_url: previewImg || undefined,
        is_final: isFinal3D ? 1 : 0,
        notes: note || undefined,
      });
      setViews3D((prev) => [
        created,
        ...(isFinal3D ? prev.map((v) => ({ ...v, is_final: 0 })) : prev),
      ]);
      setTitle3D('');
      setUrl3D('');
      setNote3D('');
      setPreviewImg3D('');
      setIsFinal3D(false);
      setShowAdd3DForm(false);
      setAdd3DError('');
      showToast(`Added 3D View: ${title}`);
    } catch (err: any) {
      const msg = err.message || 'Failed to save 3D view.';
      setAdd3DError(msg);
      showErrorToast(msg);
    } finally {
      setIsSaving3D(false);
    }
  };

  const handleStartEdit3DView = (view: BoothLink) => {
    setEditingViewId(view.id);
    setEditTitle3D(view.title);
    setEditUrl3D(view.drive_url || '');
    setEditPreviewImg3D(view.preview_image_url || '');
    setEditHasRemovedImg3D(false);
    setEditIsFinal3D(view.is_final === 1);
    setEditNote3D(view.notes || '');
    setEdit3DError('');
  };

  const handleCancelEdit3DView = () => {
    setEditingViewId(null);
    setEdit3DError('');
    setEditHasRemovedImg3D(false);
  };

  const handleSaveEdit3DView = async (id: string) => {
    setEdit3DError('');
    const title = editTitle3D.trim();
    const url = editUrl3D.trim();
    const note = editNote3D.trim();

    // 1. Existing view from state
    const existingView = views3D.find((v) => v.id === id);
    const existingSavedImagePath = !editHasRemovedImg3D ? (existingView?.preview_image_url || '') : '';
    const newUploadedImage = editPreviewImg3D.trim();

    // 2. Validate Image and Link presence
    const hasImage = Boolean(newUploadedImage || existingSavedImagePath);
    const hasLink = Boolean(url);

    if (!title) {
      const msg = 'Please enter a title.';
      setEdit3DError(msg);
      showErrorToast(msg);
      return;
    }

    if (!hasImage && !hasLink) {
      const msg = 'Please add a 3D image or a 3D view link.';
      setEdit3DError(msg);
      showErrorToast(msg);
      return;
    }

    if (hasLink && (!url.startsWith('http://') && !url.startsWith('https://'))) {
      const msg = 'Please enter a valid web URL starting with https:// or http://';
      setEdit3DError(msg);
      showErrorToast(msg);
      return;
    }

    setIsUpdating3D(true);
    try {
      const finalPreviewImg = editHasRemovedImg3D && !newUploadedImage
        ? null
        : (newUploadedImage || existingSavedImagePath || null);

      const updated = await updateLink(id, {
        category: 'render_3d',
        title,
        drive_url: url || '',
        preview_image_url: finalPreviewImg as any,
        remove_preview_image: editHasRemovedImg3D && !newUploadedImage ? 1 : 0,
        is_final: editIsFinal3D ? 1 : 0,
        notes: note || undefined,
      });

      setViews3D((prev) =>
        prev.map((v) => {
          if (v.id === id) return updated;
          if (editIsFinal3D) return { ...v, is_final: 0 };
          return v;
        })
      );
      setEditingViewId(null);
      setEdit3DError('');
      setEditHasRemovedImg3D(false);
      showToast(`Updated 3D View: ${title}`);
    } catch (err: any) {
      const msg = err.message || 'Failed to update 3D view.';
      setEdit3DError(msg);
      showErrorToast(msg);
    } finally {
      setIsUpdating3D(false);
    }
  };

  const handleDelete3DView = async (view: BoothLink) => {
    if (!confirm(`Delete 3D View "${view.title}"?`)) return;
    try {
      await deleteLink(view.id);
      setViews3D((prev) => prev.filter((v) => v.id !== view.id));
      showToast('3D View removed.');
    } catch (err: any) {
      const msg = err.message || 'Failed to remove 3D view.';
      showErrorToast(msg);
    }
  };

  // 2. Print Section Handlers
  const handleSetPrintStatus = async (val: string) => {
    setPrintStatus(val);
    try {
      const updated = await updateBooth(boothId, { print_file_status: val });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      showToast(`Print File Status set to: ${val}`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update print status.');
    }
  };

  const handleSavePrintLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = printInputUrl.trim();
    if (!url) {
      setPrintError('Please enter a Google Drive link.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setPrintError('Please enter a valid URL starting with https:// or http://');
      return;
    }

    setPrintError('');
    setIsSavingPrint(true);
    try {
      // Step 1: Write to backend
      await updateBooth(boothId, {
        print_drive_url: url,
      });

      // Step 2: Read-after-write verification: confirm persistence from SQLite via GET
      const verifiedBooth = await fetchBooth(boothId);
      const verifiedUrl = (verifiedBooth.print_drive_url || verifiedBooth.resolved_print_drive_url || '').trim();

      if (!verifiedUrl || (verifiedUrl !== url && !verifiedUrl.includes(url.replace(/^https?:\/\//, '')))) {
        throw new Error('Verification failed: Server did not confirm the saved Print Files link in database.');
      }

      // Step 3: Commit state only after verified roundtrip
      setBooth((prev) => mergeBoothCanonical(prev, {
        ...verifiedBooth,
        print_drive_url: verifiedUrl,
        resolved_print_drive_url: verifiedUrl,
      }));
      setPrintInputUrl(verifiedUrl);
      setIsEditingPrintUrl(false);
      showToast('Google Drive link saved and verified.');
    } catch (err: any) {
      setPrintError(err.message || 'Failed to save Google Drive link.');
      showErrorToast(err.message || 'Failed to save Google Drive link.');
    } finally {
      setIsSavingPrint(false);
    }
  };

  const handleRemovePrintUrl = async () => {
    if (!confirm('Remove this Google Drive link?')) return;
    setIsSavingPrint(true);
    try {
      await updateBooth(boothId, {
        print_drive_url: '',
      });
      const verifiedBooth = await fetchBooth(boothId);
      setBooth((prev) => ({
        ...verifiedBooth,
        print_drive_url: null,
        resolved_print_drive_url: null,
      }));
      setPrintInputUrl('');
      setIsEditingPrintUrl(false);
      showToast('Google Drive link removed.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to remove link.');
    } finally {
      setIsSavingPrint(false);
    }
  };

  const handleSavePrintRemark = async () => {
    try {
      const updated = await updateBooth(boothId, {
        print_remark: printRemark.trim() || null,
      });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      setPrintRemark(updated.print_remark || '');
      showToast('Print remark saved.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to save print remark.');
    }
  };

  // Goodies Artwork Status & Drive URL Handlers
  const handleSetGoodiesStatus = async (val: string) => {
    setGoodiesStatus(val);
    try {
      const updated = await updateBooth(boothId, { goodies_status: val });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      showToast(`Artwork Status: ${val}`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update goodies artwork status.');
    }
  };

  const handleSaveGoodiesArtwork = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = goodiesInputUrl.trim();
    if (!url) {
      setGoodiesError('Please enter an artwork Google Drive link.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setGoodiesError('Please enter a valid URL starting with https:// or http://');
      return;
    }

    setGoodiesError('');
    setIsSavingGoodiesArtwork(true);
    try {
      await updateBooth(boothId, {
        goodies_drive_url: url,
      });

      const verifiedBooth = await fetchBooth(boothId);
      const verifiedUrl = (verifiedBooth.goodies_drive_url || '').trim();

      if (!verifiedUrl || (verifiedUrl !== url && !verifiedUrl.includes(url.replace(/^https?:\/\//, '')))) {
        throw new Error('Verification failed: Server did not confirm the artwork link in database.');
      }

      setBooth((prev) => mergeBoothCanonical(prev, verifiedBooth));
      setGoodiesInputUrl(verifiedUrl);
      setIsEditingGoodiesUrl(false);
      showToast('Client Artwork link saved and verified.');
    } catch (err: any) {
      setGoodiesError(err.message || 'Failed to save artwork details.');
      showErrorToast(err.message || 'Failed to save artwork details.');
    } finally {
      setIsSavingGoodiesArtwork(false);
    }
  };

  const handleRemoveGoodiesUrl = async () => {
    if (!confirm('Remove this Client Artwork Drive link?')) return;
    setIsSavingGoodiesArtwork(true);
    try {
      await updateBooth(boothId, {
        goodies_drive_url: null,
      });
      const verifiedBooth = await fetchBooth(boothId);
      setBooth((prev) => mergeBoothCanonical(prev, verifiedBooth));
      setGoodiesInputUrl('');
      setIsEditingGoodiesUrl(false);
      showToast('Client artwork link removed.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to remove artwork link.');
    } finally {
      setIsSavingGoodiesArtwork(false);
    }
  };

  const handleSaveGoodiesRemark = async () => {
    try {
      const updated = await updateBooth(boothId, {
        goodies_remark: goodiesRemark.trim() || null,
      });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      setGoodiesRemark(updated.goodies_remark || '');
      showToast('Artwork remark saved.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to save artwork remark.');
    }
  };

  // Helper for Stepper (+ / -)
  const adjustQty = (currentStr: string, delta: number): string => {
    const parsed = parseInt(currentStr, 10);
    const val = isNaN(parsed) ? 1 : parsed;
    return String(Math.max(1, val + delta));
  };

  // -------------------------------------------------------------
  // Quick Add Handlers
  // -------------------------------------------------------------

  // Quick Add Ordinary Item helper
  const handleQuickAddSimpleItem = async (
    category: 'production' | 'furniture' | 'electrical' | 'goodies',
    name: string
  ) => {
    try {
      const newItem = await createItem({
        booth_id: boothId,
        category,
        item_name: name,
        quantity: 1,
        unit: 'nos',
      });

      if (category === 'production') setProdItems((prev) => [...prev, newItem]);
      else if (category === 'furniture') setFurnItems((prev) => [...prev, newItem]);
      else if (category === 'electrical') setElecItems((prev) => [...prev, newItem]);
      else if (category === 'goodies') setGoodiesItems((prev) => [...prev, newItem]);

      showToast(`Added ${name} (Qty: 1)`);
    } catch (err: any) {
      showErrorToast(err.message || `Failed to add ${name}.`);
    }
  };

  // -------------------------------------------------------------
  // Production Wall Configuration Handlers
  // -------------------------------------------------------------
  const handleSelectWallConfig = async (config: '3 Sides' | 'Back + Left' | 'Back + Right' | 'Back Wall Only') => {
    if (!booth) return;
    setIsSavingWallConfig(true);
    try {
      const updated = await updateBooth(boothId, { wall_configuration: config });
      setBooth((prev) => mergeBoothCanonical(prev, updated));
      showToast(`Wall Configuration set to: ${config}`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update wall configuration.');
    } finally {
      setIsSavingWallConfig(false);
    }
  };

  const handleClearWallConfig = async () => {
    if (!booth) return;
    setIsSavingWallConfig(true);
    try {
      const updated = await updateBooth(boothId, { wall_configuration: '' as any });
      setBooth((prev) => mergeBoothCanonical(prev, { ...updated, wall_configuration: null }));
      showToast('Wall Configuration cleared.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to clear wall configuration.');
    } finally {
      setIsSavingWallConfig(false);
    }
  };

  // Special: Add Wooden Platform Flooring + Linked Carpet
  const handleAddFlooringWithCarpet = async () => {
    try {
      const hasFlooring = prodItems.some((i) => i.item_name.toLowerCase().includes('flooring'));
      const hasCarpet = prodItems.some((i) => i.item_name.toLowerCase().includes('carpet'));

      const newItemsToAdd: BoothItemRecord[] = [];

      // 1. Create Flooring if not already present
      if (!hasFlooring) {
        const floorItem = await createItem({
          booth_id: boothId,
          category: 'production',
          item_name: 'Wooden Platform Flooring',
          quantity: 1,
          unit: 'sq.ft',
        });
        newItemsToAdd.push(floorItem);
      }

      // 2. Create Carpet with chosen color if not present
      if (!hasCarpet) {
        const carpetItem = await createItem({
          booth_id: boothId,
          category: 'production',
          item_name: 'Carpet',
          specification: `Color: ${carpetColor}`,
          notes: 'linked_flooring',
          quantity: 1,
          unit: 'sq.ft',
        });
        newItemsToAdd.push(carpetItem);
      }

      if (newItemsToAdd.length > 0) {
        setProdItems((prev) => [...prev, ...newItemsToAdd]);
        showToast(`Added Wooden Platform Flooring + ${carpetColor} Carpet`);
      } else {
        showToast('Flooring & Carpet already in checklist.');
      }
      setActiveSpecialPanel('none');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to add flooring & carpet.');
    }
  };

  // Special: Add TV in Production
  const handleAddTv = async () => {
    const qty = parseInt(tvQtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      showErrorToast('TV Quantity must be at least 1.');
      return;
    }

    try {
      const tvItem = await createItem({
        booth_id: boothId,
        category: 'production',
        item_name: `TV — ${tvSize}`,
        specification: tvMounting,
        quantity: qty,
        unit: 'nos',
      });

      setProdItems((prev) => [...prev, tvItem]);
      setActiveSpecialPanel('none');
      setTvQtyStr('1');
      showToast(`Added TV — ${tvSize} (${tvMounting})`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to add TV.');
    }
  };

  // 3, 4, 5. Custom Add Item Handlers (Production, Furniture, Electrical, Goodies)
  const handleAddCustomItem = async (category: 'production' | 'furniture' | 'electrical' | 'goodies') => {
    let name = '';
    let spec = '';
    let qtyStr = '1';

    if (category === 'production') {
      name = prodNameInput.trim();
      spec = prodSpecInput.trim();
      qtyStr = prodQtyStr;
    } else if (category === 'furniture') {
      name = furnNameInput.trim();
      qtyStr = furnQtyStr;
    } else if (category === 'electrical') {
      name = elecNameInput.trim();
      qtyStr = elecQtyStr;
    } else if (category === 'goodies') {
      name = goodiesNameInput.trim();
      spec = goodiesSpecInput.trim();
      qtyStr = goodiesQtyStr;
    }

    if (!name) return;

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      showErrorToast('Quantity must be at least 1.');
      return;
    }

    try {
      const newItem = await createItem({
        booth_id: boothId,
        category,
        item_name: name,
        specification: spec || undefined,
        quantity: qty,
        unit: 'nos',
      });

      if (category === 'production') {
        setProdItems((prev) => [...prev, newItem]);
        setProdNameInput('');
        setProdSpecInput('');
        setProdQtyStr('1');
      } else if (category === 'furniture') {
        setFurnItems((prev) => [...prev, newItem]);
        setFurnNameInput('');
        setFurnQtyStr('1');
      } else if (category === 'electrical') {
        setElecItems((prev) => [...prev, newItem]);
        setElecNameInput('');
        setElecQtyStr('1');
      } else if (category === 'goodies') {
        setGoodiesItems((prev) => [...prev, newItem]);
        setGoodiesNameInput('');
        setGoodiesSpecInput('');
        setGoodiesQtyStr('1');
        setShowCustomGoodiesForm(false);
      }

      showToast(`Added ${name} (Qty: ${qty})`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to add item.');
    }
  };

  // Delete item with linked Flooring check
  const handleDeleteItem = async (
    item: BoothItemRecord,
    category: 'production' | 'furniture' | 'electrical' | 'goodies'
  ) => {
    if (category === 'production' && item.item_name.toLowerCase().includes('flooring')) {
      const linkedCarpet = prodItems.find(
        (i) => i.id !== item.id && (i.notes === 'linked_flooring' || i.item_name.toLowerCase().includes('carpet'))
      );
      if (linkedCarpet) {
        setFlooringDeletePrompt({ flooringItem: item, carpetItem: linkedCarpet });
        return;
      }
    }

    try {
      await deleteItem(item.id);
      if (category === 'production') setProdItems((prev) => prev.filter((i) => i.id !== item.id));
      if (category === 'furniture') setFurnItems((prev) => prev.filter((i) => i.id !== item.id));
      if (category === 'electrical') setElecItems((prev) => prev.filter((i) => i.id !== item.id));
      if (category === 'goodies') setGoodiesItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast('Item removed.');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to remove item.');
    }
  };

  // Confirm delete of flooring with or without carpet
  const handleConfirmFlooringDelete = async (removeCarpet: boolean) => {
    if (!flooringDeletePrompt) return;
    const { flooringItem, carpetItem } = flooringDeletePrompt;

    try {
      await deleteItem(flooringItem.id);
      let newProd = prodItems.filter((i) => i.id !== flooringItem.id);

      if (removeCarpet && carpetItem) {
        await deleteItem(carpetItem.id);
        newProd = newProd.filter((i) => i.id !== carpetItem.id);
        showToast('Removed Wooden Platform Flooring and Carpet.');
      } else {
        showToast('Removed Wooden Platform Flooring (Carpet kept).');
      }

      setProdItems(newProd);
      setFlooringDeletePrompt(null);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to remove item.');
    }
  };

  // 4. Inline Item Edit Handlers
  const handleStartEditItem = (item: BoothItemRecord) => {
    setEditingItemId(item.id);
    setEditItemName(item.item_name);
    setEditItemSpec(item.specification || '');
    setEditItemQtyStr(String(item.quantity || 1));
    setEditItemUnit(item.unit || 'nos');
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
  };

  const handleSaveItemEdit = async (item: BoothItemRecord) => {
    if (!editItemName.trim()) {
      showErrorToast('Item name cannot be empty.');
      return;
    }
    const qty = parseInt(editItemQtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      showErrorToast('Quantity must be at least 1.');
      return;
    }

    setIsSavingItem(true);
    try {
      const updated = await updateItem(item.id, {
        category: item.category,
        item_name: editItemName.trim(),
        specification: editItemSpec.trim() || undefined,
        quantity: qty,
        unit: editItemUnit.trim() || 'nos',
      });

      if (item.category === 'production') {
        setProdItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      } else if (item.category === 'furniture') {
        setFurnItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      } else if (item.category === 'electrical') {
        setElecItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      } else if (item.category === 'goodies') {
        setGoodiesItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      }

      setEditingItemId(null);
      showToast(`Updated ${updated.item_name} (Qty: ${updated.quantity})`);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update item.');
    } finally {
      setIsSavingItem(false);
    }
  };

  // Open Edit Booth Modal
  const openEditModal = () => {
    if (!booth) return;
    setIsEditModalOpen(true);
  };

  const handleConfirmStallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booth) return;

    const num = confirmStallNumber.trim();
    if (!num || num.toLowerCase() === 'pending') {
      setConfirmError('Please enter a valid Stall / Booth number to confirm.');
      return;
    }

    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const updated = await confirmBooth(booth.id, num);
      setBooth(updated);
      setIsConfirmModalOpen(false);
      showToast(`Stall #${num} confirmed! 5-section checklist initialized.`);
      await loadAllData();
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm stall.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs">Loading booth checklist...</span>
      </div>
    );
  }

  if (error || !booth) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error || 'Booth not found.'}</p>
        <button
          onClick={() => onNavigate('booths')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
        >
          Back to Stalls Directory
        </button>
      </div>
    );
  }

  // Calculate 4-card completion status
  const sectionsList = [
    { key: 'print', label: '1. Print Files & Design', icon: Printer, desc: 'Design responsibility, 3D views, print readiness and Drive links' },
    { key: 'production', label: '2. Production', icon: Hammer, desc: 'Flooring, selfie booth, branding and TV setups' },
    { key: 'furniture', label: '3. Furniture', icon: Armchair, desc: 'Tables, sofas and chairs' },
    { key: 'electrical', label: '4. Electrical', icon: Zap, desc: 'Power sockets and pelmet lights' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 w-full min-w-0 pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
        {(() => {
          const originInfo = getBoothOrigin();
          const backRoute = originInfo?.route || (booth.event_id ? `event:${booth.event_id}` : 'booths');
          const backLabel = originInfo?.title || (booth.event_name ? booth.event_name : 'Stalls Directory');
          return (
            <button
              onClick={() => onNavigate(backRoute)}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="truncate max-w-[200px] sm:max-w-md">Back to {backLabel}</span>
            </button>
          );
        })()}

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* 1. View 3D Quick Action */}
          {primary3DTarget ? (
            valid3DViews.length > 1 ? (
              <div className="relative inline-flex items-center rounded-xl shadow-sm shrink-0">
                <a
                  href={primary3DTarget}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 sm:px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold rounded-l-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title={
                    primary3DView?.drive_url
                      ? `Open 3D Stall View: ${primary3DView.title || 'Primary View'}`
                      : `View 3D Stall Image: ${primary3DView?.title || 'Primary Image'}`
                  }
                >
                  <Box className="w-3.5 h-3.5 text-sky-400" />
                  <span>{primary3DView?.drive_url ? 'View 3D' : 'View 3D Image'}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <button
                  type="button"
                  onClick={() => setIs3DMenuOpen(!is3DMenuOpen)}
                  className="px-1.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border-y border-r border-sky-500/30 text-sky-400 text-xs rounded-r-xl transition-all flex items-center cursor-pointer"
                  title={`All 3D Views (${valid3DViews.length})`}
                  aria-expanded={is3DMenuOpen}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {is3DMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-[#161822] border border-white/[0.1] rounded-xl shadow-xl py-1 text-xs">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-white/[0.06]">
                      Saved 3D Views ({valid3DViews.length})
                    </div>
                    {valid3DViews.map((v) => {
                      const target = (v.drive_url && (v.drive_url.startsWith('https://') || v.drive_url.startsWith('http://')))
                        ? v.drive_url
                        : v.preview_image_url;
                      const isImg = !v.drive_url?.trim() && Boolean(v.preview_image_url?.trim());
                      return (
                        <a
                          key={v.id}
                          href={target || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIs3DMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isImg ? (
                              <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : (
                              <Box className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate">{v.title || '3D View'}</span>
                          </div>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {isImg && (
                              <span className="text-[9px] text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded font-mono">
                                Image
                              </span>
                            )}
                            {v.is_final === 1 && (
                              <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded font-mono">
                                Final
                              </span>
                            )}
                            <ExternalLink className="w-3 h-3 text-zinc-500" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <a
                href={primary3DTarget}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 sm:px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                title={
                  primary3DView?.drive_url
                    ? `Open 3D Stall View: ${primary3DView.title || '3D View'}`
                    : `View 3D Stall Image: ${primary3DView?.title || '3D Image'}`
                }
              >
                <Box className="w-3.5 h-3.5 text-sky-400" />
                <span>{primary3DView?.drive_url ? 'View 3D' : 'View 3D Image'}</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )
          ) : (
            <span
              className="px-2.5 sm:px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-zinc-500 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-not-allowed select-none opacity-60 shrink-0"
              title="No 3D Stall View or image saved for this booth yet"
            >
              <Box className="w-3.5 h-3.5 text-zinc-600" />
              <span>View 3D</span>
            </span>
          )}

          {/* 2. Print Files Google Drive Quick Action */}
          {validPrintFilesUrl ? (
            <a
              href={validPrintFilesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 sm:px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Open Google Drive Print Files Folder"
            >
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Print Files</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          ) : (
            <span
              className="px-2.5 sm:px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-zinc-500 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-not-allowed select-none opacity-60 shrink-0"
              title="No Google Drive Print Files folder saved for this booth yet"
            >
              <Folder className="w-3.5 h-3.5 text-zinc-600" />
              <span>Print Files</span>
            </span>
          )}

          {/* 3. Share Stall Details */}
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Share Client Stall Details PDF"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Stall Details</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Print Clean A4 Checklist Sheet"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Checklist</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-amber-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Floor Plan</span>
          </button>

          <button
            onClick={openEditModal}
            className="px-2.5 sm:px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {booth.status !== 'archived' && (
            <button
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="p-1.5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-xl transition-colors cursor-pointer border border-white/[0.08]"
              title="Archive Stall"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer border border-white/[0.08]"
            title="Delete Stall Permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simplified Top Header */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {booth.client_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {booth.booking_stage === 'discussion' ? (
                <>
                  <span className="font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-md font-semibold">
                    {booth.booth_number && !isPendingOrEmpty(booth.booth_number)
                      ? `Stall #${booth.booth_number}`
                      : 'Not Assigned'}
                  </span>
                  <span>•</span>
                  <span className="text-sky-400 font-semibold bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-xs">
                    Ongoing Discussion
                  </span>
                </>
              ) : (
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md">
                  {booth.booth_number && !isPendingOrEmpty(booth.booth_number)
                    ? `Booth #${booth.booth_number}`
                    : 'Not Assigned'}
                </span>
              )}
              <span>•</span>
              <span className="text-zinc-300 font-mono">{booth.stand_size || '3 × 3 m'}</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {getStallTypeLabel(booth.booth_type)}
              </span>
              <span>•</span>
              <span
                className="text-zinc-300 font-medium bg-zinc-800/80 border border-zinc-700/60 px-2.5 py-0.5 rounded inline-flex items-center gap-1.5"
                title={booth.wall_configuration ? `Wall Configuration: ${booth.wall_configuration}` : 'Wall Configuration: Not Configured'}
              >
                <span className="text-zinc-400 text-xs font-normal">Walls:</span>
                <span className={booth.wall_configuration ? 'text-amber-300 font-semibold' : 'text-zinc-400 font-mono'}>
                  {booth.wall_configuration || 'Not Configured'}
                </span>
              </span>
              {booth.event_name && (
                <>
                  <span>•</span>
                  <span className="text-zinc-400 truncate max-w-xs">{booth.event_name}</span>
                </>
              )}
              {booth.phone && (
                <>
                  <span>•</span>
                  <a
                    href={`tel:${booth.phone}`}
                    className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{booth.phone}</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Overall Checklist Progress Badge or Confirm Button */}
          {booth.booking_stage === 'discussion' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmStallNumber(
                    booth.booth_number && !isPendingOrEmpty(booth.booth_number)
                      ? booth.booth_number
                      : ''
                  );
                  setConfirmError('');
                  setIsConfirmModalOpen(true);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Stall</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#121319] border border-white/[0.06] rounded-xl p-3 sm:p-3.5 min-w-[240px] space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-3">
                <span className="text-zinc-400 font-medium">Checklist Progress</span>
                <span className="font-bold text-amber-400 font-mono">
                  {checklistCounts.applicable === 0
                    ? 'No Applicable Tasks'
                    : `${checklistCounts.done} of ${checklistCounts.applicable} (${checklistCounts.percentage}%)`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    checklistCounts.applicable === 0
                      ? 'bg-zinc-700'
                      : checklistCounts.percentage === 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${checklistCounts.applicable === 0 ? 0 : checklistCounts.percentage}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-0.5 font-mono">
                <span>
                  <span className="text-emerald-400 font-semibold">{checklistCounts.done} Done</span>
                  {' • '}
                  <span className="text-zinc-400">{checklistCounts.na} Not Required</span>
                  {' • '}
                  <span className={checklistCounts.pending > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-500'}>
                    {checklistCounts.pending} Pending
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ongoing Discussion Banner */}
      {booth.booking_stage === 'discussion' && (
        <div className="bg-[#15171e] border border-sky-500/30 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-zinc-100">Ongoing Client Discussion</h2>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    Lead / Unconfirmed
                  </span>
                </div>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  This stall is in discussion and not yet confirmed. Production checklist tasks, artwork proofs, and fabrication tracking will become available once confirmed.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmStallNumber(
                  booth.booth_number && !isPendingOrEmpty(booth.booth_number)
                    ? booth.booth_number
                    : ''
                );
                setConfirmError('');
                setIsConfirmModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Stall</span>
            </button>
          </div>

          {booth.discussion_remark && (
            <div className="p-3.5 rounded-xl bg-[#121319] border border-white/[0.06] text-xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Discussion Remark
              </span>
              <p className="text-zinc-200 italic">"{booth.discussion_remark}"</p>
            </div>
          )}
        </div>
      )}

      {/* Main Checklist: 6 Expandable Cards */}
      <div className="space-y-3">
        {sectionsList.map((sec) => {
          const Icon = sec.icon;
          const isExp = expanded[sec.key];
          const task = getTaskForSection(sec.key);
          const status = task?.status || (task?.is_completed ? 'completed' : 'pending');
          const isDone = status === 'completed';
          const isNA = status === 'not_applicable';

          return (
            <div
              key={sec.key}
              className={`bg-[#15171e] border rounded-2xl overflow-hidden transition-all shadow-sm ${
                isDone
                  ? 'border-emerald-500/30'
                  : isNA
                  ? 'border-white/[0.04] opacity-75'
                  : 'border-white/[0.07] hover:border-white/[0.14]'
              }`}
            >
              {/* Card Header Row - Fully responsive for mobile touch */}
              <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-3 bg-[#121319]/80 border-b border-white/[0.04]">
                <div
                  onClick={() => toggleSection(sec.key)}
                  className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0 cursor-pointer select-none"
                >
                  <div
                    className={`p-2 rounded-xl border shrink-0 ${
                      isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isNA
                        ? 'bg-white/[0.04] border-white/[0.08] text-zinc-500'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3
                        className={`text-sm font-bold tracking-wide truncate ${
                          isDone ? 'text-zinc-100 line-through decoration-emerald-500/60' : isNA ? 'text-zinc-400' : 'text-zinc-100'
                        }`}
                      >
                        {sec.label}
                      </h3>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      )}
                      {isNA && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                          Not Required
                        </span>
                      )}
                      {!isDone && !isNA && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/90 border border-amber-500/20">
                          Pending
                        </span>
                      )}
                      {sec.key === 'print' && savedPrintUrl && (
                        <a
                          href={savedPrintUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Google Drive folder in new tab"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open Drive</span>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{sec.desc}</p>
                  </div>
                </div>

                {/* Right Action Controls: N/A, Mark Done & Chevron */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    title={isNA ? 'Re-enable as required (Pending)' : 'Mark as Not Required (N/A)'}
                    onClick={() => handleToggleTaskStatus(sec.key, isNA ? 'pending' : 'not_applicable')}
                    className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center ${
                      isNA
                        ? 'bg-zinc-800 text-zinc-200 border-zinc-600 shadow-sm'
                        : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    N/A
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleTaskStatus(sec.key)}
                    disabled={isNA}
                    title={isNA ? 'Section is Not Required — clear N/A to mark as Done' : isDone ? 'Reopen section' : 'Mark section as Done'}
                    className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                      isDone
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-sm cursor-pointer'
                        : isNA
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed pointer-events-none'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-amber-500 hover:text-amber-400 cursor-pointer'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isDone ? 'Done' : 'Mark Done'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSection(sec.key)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    aria-label={isExp ? 'Collapse' : 'Expand'}
                  >
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Card Expanded Content */}
              {isExp && (
                <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/40 space-y-4 animate-in fade-in duration-150">
                  {/* SECTION 1: PRINT FILES & DESIGN (Merged Design Responsibility + 3D Views + Print Files + Goodies) */}
                  {sec.key === 'print' && (
                    <div className="space-y-6">
                      <div className="space-y-5">
                        {/* 1. Design Responsibility */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-zinc-200">
                              Design Responsibility
                            </label>
                            {isSavingDesign && (
                              <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                                Saving...
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-md">
                            <button
                              type="button"
                              onClick={() => handleSetDesignResponsibility('Client Side')}
                              disabled={isSavingDesign}
                              className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                designResp === 'Client Side'
                                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${designResp === 'Client Side' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                                <span>Client Side</span>
                              </div>
                              {designResp === 'Client Side' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetDesignResponsibility('Our Side')}
                              disabled={isSavingDesign}
                              className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                designResp === 'Our Side'
                                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${designResp === 'Our Side' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                                <span>Our Side</span>
                              </div>
                              {designResp === 'Our Side' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </button>
                          </div>
                        </div>

                        {/* 2. 3D Stall Views */}
                        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Box className="w-3.5 h-3.5 text-amber-400" />
                                <span>3D Stall Views</span>
                              </h4>
                              {views3D.length > 0 && (
                                <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
                                  {views3D.length}
                                </span>
                              )}
                            </div>
                            {!showAdd3DForm && (
                              <button
                                type="button"
                                onClick={() => setShowAdd3DForm(true)}
                                className="text-xs text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add View</span>
                              </button>
                            )}
                          </div>

                          {/* Saved 3D Views as simple rows: Front View — Open | Edit | Remove */}
                          {views3D.length > 0 ? (
                            <div className="space-y-1.5">
                              {views3D.map((view) => {
                                const isEditing = editingViewId === view.id;

                                if (isEditing) {
                                  return (
                                    <div
                                      key={view.id}
                                      className="p-3 rounded-xl bg-zinc-900 border border-amber-500/50 space-y-2.5 animate-in fade-in duration-100"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                                          Edit 3D View
                                        </span>
                                        <button
                                          type="button"
                                          onClick={handleCancelEdit3DView}
                                          className="text-zinc-400 hover:text-zinc-200 text-xs p-1"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {edit3DError && (
                                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in duration-100">
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                          <span>{edit3DError}</span>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-zinc-400 block mb-0.5 font-medium">View Title</label>
                                          <input
                                            type="text"
                                            value={editTitle3D}
                                            onChange={(e) => { setEditTitle3D(e.target.value); setEdit3DError(''); }}
                                            placeholder="e.g. Front View"
                                            className="w-full min-h-[36px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-zinc-400 block mb-0.5 font-medium">3D View Link / URL (Optional if image added)</label>
                                          <input
                                            type="url"
                                            value={editUrl3D}
                                            onChange={(e) => { setEditUrl3D(e.target.value); setEdit3DError(''); }}
                                            placeholder="https://... (Optional)"
                                            className="w-full min-h-[36px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[10px] text-zinc-400 block font-medium">3D Preview Image (Optional)</label>
                                          {editPreviewImg3D && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditPreviewImg3D('');
                                                setEditHasRemovedImg3D(true);
                                                setEdit3DError('');
                                              }}
                                              className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                                            >
                                              Remove Image
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {editPreviewImg3D ? (
                                            <div className="relative w-12 h-9 rounded bg-black/40 border border-amber-500/40 overflow-hidden shrink-0">
                                              <img src={editPreviewImg3D} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                          ) : null}
                                          <label className="min-h-[34px] px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors shrink-0">
                                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                                            <span>{isEditingUploading3DImg ? 'Uploading...' : editPreviewImg3D ? 'Change Image' : 'Upload Image (JPG/PNG/WebP)'}</span>
                                            <input
                                              type="file"
                                              accept="image/jpeg,image/png,image/webp"
                                              onChange={(e) => handleUpload3DImage(e, true)}
                                              disabled={isEditingUploading3DImg}
                                              className="hidden"
                                            />
                                          </label>
                                          <input
                                            type="text"
                                            value={editPreviewImg3D}
                                            onChange={(e) => setEditPreviewImg3D(e.target.value)}
                                            placeholder="Or paste direct image URL (https://...)"
                                            className="flex-1 min-h-[34px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Note / Remark (Optional)</label>
                                        <input
                                          type="text"
                                          value={editNote3D}
                                          onChange={(e) => setEditNote3D(e.target.value)}
                                          placeholder="e.g. Client-approved version"
                                          className="w-full min-h-[36px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                                        />
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={editIsFinal3D}
                                            onChange={(e) => setEditIsFinal3D(e.target.checked)}
                                            className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-0 cursor-pointer"
                                          />
                                          <span className="font-medium text-[11px]">Designate as Primary / Final 3D View (used for PDF preview)</span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={handleCancelEdit3DView}
                                            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isUpdating3D || isEditingUploading3DImg}
                                            onClick={() => handleSaveEdit3DView(view.id)}
                                            className="min-h-[34px] px-3.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                          >
                                            {isUpdating3D ? 'Saving...' : 'Save Changes'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                const hasImg = Boolean(view.preview_image_url && view.preview_image_url.trim());
                                const hasUrl = Boolean(view.drive_url && view.drive_url.trim());

                                return (
                                  <div
                                    key={view.id}
                                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {hasImg ? (
                                        brokenThumbnails.has(view.preview_image_url!) ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setModalImgError(false);
                                              setModalImgRetryKey(0);
                                              setPreviewModalImg({ url: view.preview_image_url!, title: view.title });
                                            }}
                                            className="w-8 h-8 rounded border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0 cursor-pointer text-amber-400 hover:bg-amber-500/20 transition-colors"
                                            title="Image preview unavailable — Click to view details or retry"
                                          >
                                            <ImageIcon className="w-4 h-4 opacity-70" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setModalImgError(false);
                                              setModalImgRetryKey(0);
                                              setPreviewModalImg({ url: view.preview_image_url!, title: view.title });
                                            }}
                                            className="w-8 h-8 rounded border border-zinc-700 bg-black/40 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                            title="Click to view full image"
                                          >
                                            <img
                                              src={view.preview_image_url || undefined}
                                              alt={view.title}
                                              className="w-full h-full object-cover"
                                              onError={() => {
                                                if (view.preview_image_url) {
                                                  setBrokenThumbnails((prev) => new Set(prev).add(view.preview_image_url!));
                                                }
                                              }}
                                            />
                                          </button>
                                        )
                                      ) : (
                                        <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0 text-amber-400/80">
                                          <Box className="w-4 h-4" />
                                        </div>
                                      )}
                                      <span className="font-semibold text-zinc-200 text-xs truncate" title={view.title}>
                                        {view.title}
                                      </span>
                                      {view.is_final === 1 && (
                                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                          Final
                                        </span>
                                      )}
                                      {view.notes && (
                                        <span className="text-[10px] text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium truncate max-w-[120px] sm:max-w-xs">
                                          {view.notes}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
                                      {hasImg && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setModalImgError(false);
                                            setModalImgRetryKey(0);
                                            setPreviewModalImg({ url: view.preview_image_url!, title: view.title });
                                          }}
                                          className="text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                          title="View full-size 3D image"
                                        >
                                          <Eye className="w-3 h-3" />
                                          <span>View Image</span>
                                        </button>
                                      )}
                                      {hasImg && hasUrl && (
                                        <span className="text-zinc-600">|</span>
                                      )}
                                      {hasUrl && (
                                        <a
                                          href={view.drive_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1"
                                          title="Open 3D View in new tab"
                                        >
                                          <span>Open 3D View</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                      <span className="text-zinc-600">|</span>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit3DView(view)}
                                        className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                                        title="Edit View"
                                      >
                                        Edit
                                      </button>
                                      <span className="text-zinc-600">|</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete3DView(view)}
                                        className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                        title="Remove View"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-zinc-500 italic">No 3D views added yet.</p>
                          )}

                          {/* Inline Add 3D View Form */}
                          {showAdd3DForm && (
                            <form onSubmit={handleAdd3DView} className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add 3D View</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setShowAdd3DForm(false); setAdd3DError(''); }}
                                  className="text-zinc-500 hover:text-zinc-300 text-xs p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {add3DError && (
                                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in duration-100">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{add3DError}</span>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                  {['Front View', 'Perspective View', 'Option 1', 'Top View', 'Final 3D View'].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setTitle3D(preset)}
                                      className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors cursor-pointer ${
                                        title3D === preset
                                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-semibold'
                                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  value={title3D}
                                  onChange={(e) => setTitle3D(e.target.value)}
                                  placeholder="View Title (e.g. Front View)"
                                  className="w-full min-h-[36px] bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                  required
                                />
                              </div>

                              <div className="space-y-1">
                                <input
                                  type="url"
                                  value={url3D}
                                  onChange={(e) => setUrl3D(e.target.value)}
                                  placeholder="3D View Link / URL (Optional if image uploaded)"
                                  className="w-full min-h-[36px] bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] text-zinc-400 font-semibold block">3D Preview Image (Optional)</label>
                                  {previewImg3D && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImg3D('')}
                                      className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                                    >
                                      Remove Image
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {previewImg3D ? (
                                    <div className="relative w-12 h-9 rounded bg-black/40 border border-amber-500/40 overflow-hidden shrink-0">
                                      <img src={previewImg3D} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                  ) : null}
                                  <label className="min-h-[34px] px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors shrink-0">
                                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{isUploading3DImg ? 'Uploading...' : previewImg3D ? 'Change Image' : 'Upload Image (JPG/PNG/WebP)'}</span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      onChange={(e) => handleUpload3DImage(e, false)}
                                      disabled={isUploading3DImg}
                                      className="hidden"
                                    />
                                  </label>
                                  <input
                                    type="text"
                                    value={previewImg3D}
                                    onChange={(e) => setPreviewImg3D(e.target.value)}
                                    placeholder="Or paste direct image URL (https://...)"
                                    className="flex-1 min-h-[34px] bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={note3D}
                                  onChange={(e) => setNote3D(e.target.value)}
                                  placeholder="Note / Remark (Optional)"
                                  className="w-full min-h-[36px] bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none py-0.5">
                                <input
                                  type="checkbox"
                                  checked={isFinal3D}
                                  onChange={(e) => setIsFinal3D(e.target.checked)}
                                  className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-0 cursor-pointer"
                                />
                                <span className="font-medium text-[11px]">Designate as Primary / Final 3D View (used for PDF preview)</span>
                              </label>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setShowAdd3DForm(false)}
                                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSaving3D || isUploading3DImg}
                                  className="min-h-[34px] px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm"
                                >
                                  {isSaving3D ? 'Saving...' : 'Save 3D View'}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>

                        {/* 3. Print File Readiness */}
                        <div className="pt-4 border-t border-zinc-800/80 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-200">
                            Print File Readiness
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                              { value: 'Designs Pending', color: 'zinc' },
                              { value: 'Partially Received', color: 'amber' },
                              { value: 'All Files Ready', color: 'emerald' },
                            ].map((opt) => {
                              const isSelected = printStatus === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSetPrintStatus(opt.value)}
                                  className={`min-h-[40px] p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                    isSelected
                                      ? opt.color === 'emerald'
                                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                                        : opt.color === 'amber'
                                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                                        : 'bg-white/[0.08] border-zinc-600 text-zinc-100 font-bold'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  <span>{opt.value}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 4. Main Google Drive Print Files Link */}
                        <div className="pt-4 border-t border-zinc-800/80 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-200">
                            Main Google Drive Print Files Link
                          </label>

                          {hasSavedPrintUrl && !isEditingPrintUrl ? (
                            <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                                  <ExternalLink className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-zinc-200">Google Drive Folder</span>
                                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                                      Saved
                                    </span>
                                  </div>
                                  <a
                                    href={savedPrintUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-amber-400 hover:underline truncate block max-w-sm sm:max-w-md md:max-w-lg font-mono mt-0.5"
                                    title={savedPrintUrl!}
                                  >
                                    {savedPrintUrl}
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                <a
                                  href={savedPrintUrl!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[34px] px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
                                >
                                  <span>Open Drive</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingPrintUrl(true);
                                    setPrintInputUrl(savedPrintUrl || '');
                                    setPrintError('');
                                  }}
                                  className="min-h-[34px] px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Edit Drive URL"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRemovePrintUrl}
                                  disabled={isSavingPrint}
                                  className="min-h-[34px] px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Remove Drive URL"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="url"
                                  value={printInputUrl}
                                  onChange={(e) => {
                                    setPrintInputUrl(e.target.value);
                                    if (printError) setPrintError('');
                                  }}
                                  placeholder="https://drive.google.com/drive/folders/..."
                                  className={`flex-1 min-h-[42px] bg-zinc-900 border rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none ${
                                    printError ? 'border-red-500 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500'
                                  }`}
                                />
                                <div className="flex items-center gap-2">
                                  {isEditingPrintUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsEditingPrintUrl(false);
                                        setPrintInputUrl(savedPrintUrl || '');
                                        setPrintError('');
                                      }}
                                      className="min-h-[42px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-semibold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={handleSavePrintLink}
                                    disabled={isSavingPrint}
                                    className="min-h-[42px] px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 font-bold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{isSavingPrint ? 'Saving & Verifying...' : isEditingPrintUrl ? 'Update Link' : 'Save Link'}</span>
                                  </button>
                                </div>
                              </div>
                              {printError && <p className="text-xs text-red-400">{printError}</p>}
                            </div>
                          )}
                        </div>

                        {/* 5. Optional Print Remark */}
                        <div className="pt-4 border-t border-zinc-800/80 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-200">
                            Print Remark (Optional)
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={printRemark}
                              onChange={(e) => setPrintRemark(e.target.value)}
                              onBlur={handleSavePrintRemark}
                              placeholder="e.g. Waiting for side wall artwork / high-res logo"
                              className="flex-1 min-h-[40px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={handleSavePrintRemark}
                              className="min-h-[40px] px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                            >
                              Save Remark
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SUBSECTION: GOODIES & PROMOTIONAL PRINTING */}
                      <div className="pt-5 border-t border-zinc-800/90 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                              <span>Goodies & Promotional Printing</span>
                            </h4>
                            <p className="text-[11px] text-zinc-400">
                              Optional giveaways (book, pen, leaflet) & client-supplied artwork.
                            </p>
                          </div>
                          {goodiesItems.length > 0 && (
                            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              {goodiesItems.length} {goodiesItems.length === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </div>

                        {/* Goodies Items List */}
                        {goodiesItems.length > 0 ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Saved Requirements ({goodiesItems.length})
                            </span>
                            <div className="space-y-1.5">
                              {goodiesItems.map((itm) => (
                                <ItemRow
                                  key={itm.id}
                                  item={itm}
                                  isEditing={editingItemId === itm.id}
                                  editName={editItemName}
                                  editSpec={editItemSpec}
                                  editQtyStr={editItemQtyStr}
                                  editUnit={editItemUnit}
                                  isSaving={isSavingItem}
                                  onStartEdit={() => handleStartEditItem(itm)}
                                  onCancelEdit={handleCancelEditItem}
                                  onSaveEdit={() => handleSaveItemEdit(itm)}
                                  onChangeName={setEditItemName}
                                  onChangeSpec={setEditItemSpec}
                                  onChangeQtyStr={setEditItemQtyStr}
                                  onChangeUnit={setEditItemUnit}
                                  onAdjustQty={(delta) => setEditItemQtyStr(adjustQty(editItemQtyStr, delta))}
                                  onDelete={() => handleDeleteItem(itm, 'goodies')}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 italic">No goodies or promotional items added yet.</p>
                        )}

                        {/* Quick Add Presets: Book, Pen, Leaflet, Custom Item */}
                        <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Plus className="w-3 h-3 text-amber-400" />
                              Quick Add Presets
                            </span>
                            <span className="text-[10px] text-zinc-500">Tap to add Qty 1</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Book', 'Pen', 'Leaflet'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleQuickAddSimpleItem('goodies', preset)}
                                className="min-h-[38px] px-3 py-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/60 hover:border-amber-500/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                              >
                                <span>{preset}</span>
                                <Plus className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 group-hover:scale-110 transition-transform" />
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setShowCustomGoodiesForm((prev) => !prev)}
                              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group ${
                                showCustomGoodiesForm
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                  : 'border-dashed border-zinc-700/80 bg-zinc-950/40 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-amber-500/60'
                              }`}
                            >
                              <span>Custom Item</span>
                              <Plus className={`w-3.5 h-3.5 transition-transform ${showCustomGoodiesForm ? 'rotate-45 text-amber-400' : 'text-amber-400/80 group-hover:text-amber-400'}`} />
                            </button>
                          </div>
                        </div>

                        {/* Custom Goodies Item Form (Collapsible) */}
                        {showCustomGoodiesForm && (
                          <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2 animate-in fade-in duration-150">
                            <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                              + Custom Promotional Item
                            </span>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={goodiesNameInput}
                                onChange={(e) => setGoodiesNameInput(e.target.value)}
                                placeholder="e.g. Tote Bag, Lanyard, Badge, Cap"
                                className="flex-1 min-h-[42px] bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                              />
                              <input
                                type="text"
                                value={goodiesSpecInput}
                                onChange={(e) => setGoodiesSpecInput(e.target.value)}
                                placeholder="Specification / remark (optional)"
                                className="sm:w-48 min-h-[42px] bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                              />
                              <div className="flex items-center gap-2">
                                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-h-[42px]">
                                  <button
                                    type="button"
                                    onClick={() => setGoodiesQtyStr(adjustQty(goodiesQtyStr, -1))}
                                    className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={goodiesQtyStr}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setGoodiesQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                                    onBlur={() => {
                                      if (!goodiesQtyStr || parseInt(goodiesQtyStr, 10) < 1) setGoodiesQtyStr('1');
                                    }}
                                    className="w-14 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setGoodiesQtyStr(adjustQty(goodiesQtyStr, 1))}
                                    className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddCustomItem('goodies')}
                                  className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* CLIENT ARTWORK & READINESS: ONLY SHOWN WHEN AT LEAST ONE GOODIES ITEM HAS BEEN ADDED */}
                        {goodiesItems.length > 0 && (
                          <div className="pt-4 mt-2 border-t border-zinc-800/80 space-y-3.5 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/50">
                            <div>
                              <span className="text-xs font-bold text-zinc-200">
                                Client-Supplied Artwork (Goodies)
                              </span>
                              <p className="text-[11px] text-zinc-400">
                                Design/artwork for promotional items is provided directly by the client.
                              </p>
                            </div>

                            {/* Artwork Readiness Status */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-zinc-300">
                                Artwork Readiness Status
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                  { value: 'Awaiting Client Artwork', color: 'zinc' },
                                  { value: 'Artwork Received', color: 'amber' },
                                  { value: 'Ready for Printing', color: 'emerald' },
                                ].map((opt) => {
                                  const isSelected = goodiesStatus === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => handleSetGoodiesStatus(opt.value)}
                                      className={`min-h-[42px] p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                        isSelected
                                          ? opt.color === 'emerald'
                                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                                            : opt.color === 'amber'
                                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                                            : 'bg-white/[0.08] border-zinc-600 text-zinc-100 font-bold'
                                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <span>{opt.value}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Client Artwork Google Drive Link */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-zinc-300">
                                Client Artwork Google Drive Link
                              </label>

                              {hasSavedGoodiesUrl && !isEditingGoodiesUrl ? (
                                <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                                      <ExternalLink className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-zinc-200">Client Artwork Drive</span>
                                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                          Saved
                                        </span>
                                      </div>
                                      <a
                                        href={savedGoodiesUrl!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-amber-400 hover:underline truncate block max-w-sm sm:max-w-md md:max-w-lg font-mono mt-0.5"
                                        title={savedGoodiesUrl!}
                                      >
                                        {savedGoodiesUrl}
                                      </a>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    <a
                                      href={savedGoodiesUrl!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="min-h-[34px] px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
                                    >
                                      <span>Open Artwork</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsEditingGoodiesUrl(true);
                                        setGoodiesInputUrl(savedGoodiesUrl || '');
                                        setGoodiesError('');
                                      }}
                                      className="min-h-[34px] px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Edit Artwork URL"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleRemoveGoodiesUrl}
                                      disabled={isSavingGoodiesArtwork}
                                      className="min-h-[34px] px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Remove Artwork URL"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      type="url"
                                      value={goodiesInputUrl}
                                      onChange={(e) => {
                                        setGoodiesInputUrl(e.target.value);
                                        if (goodiesError) setGoodiesError('');
                                      }}
                                      placeholder="https://drive.google.com/drive/folders/..."
                                      className={`flex-1 min-h-[42px] bg-zinc-900 border rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none ${
                                        goodiesError ? 'border-red-500 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500'
                                      }`}
                                    />
                                    <div className="flex items-center gap-2">
                                      {isEditingGoodiesUrl && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsEditingGoodiesUrl(false);
                                            setGoodiesInputUrl(savedGoodiesUrl || '');
                                            setGoodiesError('');
                                          }}
                                          className="min-h-[42px] px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-semibold cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={handleSaveGoodiesArtwork}
                                        disabled={isSavingGoodiesArtwork}
                                        className="min-h-[42px] px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 font-bold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>{isSavingGoodiesArtwork ? 'Saving & Verifying...' : isEditingGoodiesUrl ? 'Update Link' : 'Save Link'}</span>
                                      </button>
                                    </div>
                                  </div>
                                  {goodiesError && <p className="text-xs text-red-400">{goodiesError}</p>}
                                </div>
                              )}
                            </div>

                            {/* Artwork Remark */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-zinc-300">
                                Artwork Remark (Optional)
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={goodiesRemark}
                                  onChange={(e) => setGoodiesRemark(e.target.value)}
                                  onBlur={handleSaveGoodiesRemark}
                                  placeholder="e.g. Waiting for high-res logo for pen clip / A5 artwork verified"
                                  className="flex-1 min-h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveGoodiesRemark}
                                  className="min-h-[42px] px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                                >
                                  Save Remark
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: REFINED PRODUCTION QUICK ADD */}
                  {sec.key === 'production' && (
                    <div className="space-y-4">
                      {/* Booth Wall Configuration Block */}
                      <div className="bg-[#12141a] border border-white/[0.08] rounded-xl p-3 sm:p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-amber-400" />
                                Booth Wall Configuration
                              </span>
                              {booth?.wall_configuration ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                                  {booth.wall_configuration}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-800/80 border border-white/[0.08] text-zinc-400 font-mono text-[10px]">
                                  Unset
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Stall wall structure for production fabrication & site setup
                            </p>
                          </div>

                          {booth?.wall_configuration && (
                            <button
                              type="button"
                              disabled={isSavingWallConfig}
                              onClick={handleClearWallConfig}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer disabled:opacity-50"
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>

                        {/* Three Selectable Configuration Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Option 1: 3 Sides */}
                          <button
                            type="button"
                            disabled={isSavingWallConfig}
                            onClick={() => handleSelectWallConfig('3 Sides')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                              booth?.wall_configuration === '3 Sides'
                                ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-zinc-100 shadow-sm'
                                : 'bg-[#161922] border-white/[0.07] text-zinc-300 hover:bg-[#1a1e29] hover:border-white/[0.14]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                                3 Sides
                              </span>
                              <svg className="w-6 h-6 shrink-0" viewBox="0 0 32 32" fill="none">
                                <rect x="5" y="5" width="22" height="22" rx="2" className="fill-white/[0.02] stroke-white/[0.06]" strokeDasharray="2 2" />
                                <path d="M 7 27 L 7 7 L 25 7 L 25 27" className={booth?.wall_configuration === '3 Sides' ? 'stroke-amber-400' : 'stroke-zinc-400'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M 7 27 L 25 27" className="stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="3 3" />
                              </svg>
                            </div>
                            <div className="text-[10px] text-zinc-400 leading-snug">
                              Back Wall + Left Wall + Right Wall (1 Open Front)
                            </div>
                            <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                              <span className={booth?.wall_configuration === '3 Sides' ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                                {booth?.wall_configuration === '3 Sides' ? '✓ Selected' : 'Tap to select'}
                              </span>
                            </div>
                          </button>

                          {/* Option 2: 2 Sides */}
                          {(() => {
                            const is2SidesActive = booth?.wall_configuration === 'Back + Left' || booth?.wall_configuration === 'Back + Right';
                            return (
                              <button
                                type="button"
                                disabled={isSavingWallConfig}
                                onClick={() => {
                                  if (!is2SidesActive) {
                                    handleSelectWallConfig('Back + Left');
                                  }
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                                  is2SidesActive
                                    ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-zinc-100 shadow-sm'
                                    : 'bg-[#161922] border-white/[0.07] text-zinc-300 hover:bg-[#1a1e29] hover:border-white/[0.14]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                                    2 Sides
                                    {is2SidesActive && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                                        {booth?.wall_configuration}
                                      </span>
                                    )}
                                  </span>
                                  <svg className="w-6 h-6 shrink-0" viewBox="0 0 32 32" fill="none">
                                    <rect x="5" y="5" width="22" height="22" rx="2" className="fill-white/[0.02] stroke-white/[0.06]" strokeDasharray="2 2" />
                                    {booth?.wall_configuration === 'Back + Right' ? (
                                      <>
                                        <path d="M 7 7 L 25 7 L 25 27" className={is2SidesActive ? 'stroke-amber-400' : 'stroke-zinc-400'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M 7 7 L 7 27 L 25 27" className="stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="3 3" />
                                      </>
                                    ) : (
                                      <>
                                        <path d="M 7 27 L 7 7 L 25 7" className={is2SidesActive ? 'stroke-amber-400' : 'stroke-zinc-400'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M 25 7 L 25 27 L 7 27" className="stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="3 3" />
                                      </>
                                    )}
                                  </svg>
                                </div>
                                <div className="text-[10px] text-zinc-400 leading-snug">
                                  Back Wall + One Side Wall (Corner Stall)
                                </div>
                                <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                                  <span className={is2SidesActive ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                                    {is2SidesActive ? `✓ ${booth?.wall_configuration}` : 'Tap to select'}
                                  </span>
                                </div>
                              </button>
                            );
                          })()}

                          {/* Option 3: Back Wall Only */}
                          <button
                            type="button"
                            disabled={isSavingWallConfig}
                            onClick={() => handleSelectWallConfig('Back Wall Only')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                              booth?.wall_configuration === 'Back Wall Only'
                                ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-zinc-100 shadow-sm'
                                : 'bg-[#161922] border-white/[0.07] text-zinc-300 hover:bg-[#1a1e29] hover:border-white/[0.14]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                                Back Wall Only
                              </span>
                              <svg className="w-6 h-6 shrink-0" viewBox="0 0 32 32" fill="none">
                                <rect x="5" y="5" width="22" height="22" rx="2" className="fill-white/[0.02] stroke-white/[0.06]" strokeDasharray="2 2" />
                                <path d="M 7 7 L 25 7" className={booth?.wall_configuration === 'Back Wall Only' ? 'stroke-amber-400' : 'stroke-zinc-400'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M 7 7 L 7 27 L 25 27 L 25 7" className="stroke-emerald-400/50" strokeWidth="1.5" strokeDasharray="3 3" />
                              </svg>
                            </div>
                            <div className="text-[10px] text-zinc-400 leading-snug">
                              Only Back Wall (3 Open Sides / Peninsula Stall)
                            </div>
                            <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                              <span className={booth?.wall_configuration === 'Back Wall Only' ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                                {booth?.wall_configuration === 'Back Wall Only' ? '✓ Selected' : 'Tap to select'}
                              </span>
                            </div>
                          </button>
                        </div>

                        {/* Additional Selector for 2 Sides */}
                        {(booth?.wall_configuration === 'Back + Left' || booth?.wall_configuration === 'Back + Right') && (
                          <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
                            <span className="text-xs font-semibold text-zinc-300">Side Wall Orientation:</span>
                            <div className="inline-flex rounded-lg bg-zinc-900 border border-white/[0.08] p-0.5">
                              <button
                                type="button"
                                disabled={isSavingWallConfig}
                                onClick={() => handleSelectWallConfig('Back + Left')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                  booth?.wall_configuration === 'Back + Left'
                                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                Back + Left
                              </button>
                              <button
                                type="button"
                                disabled={isSavingWallConfig}
                                onClick={() => handleSelectWallConfig('Back + Right')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                  booth?.wall_configuration === 'Back + Right'
                                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                Back + Right
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Production Items List */}
                      {prodItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Saved Requirements ({prodItems.length})
                          </span>
                          <div className="space-y-1.5">
                            {prodItems.map((itm) => (
                              <ItemRow
                                key={itm.id}
                                item={itm}
                                isEditing={editingItemId === itm.id}
                                editName={editItemName}
                                editSpec={editItemSpec}
                                editQtyStr={editItemQtyStr}
                                editUnit={editItemUnit}
                                isSaving={isSavingItem}
                                onStartEdit={() => handleStartEditItem(itm)}
                                onCancelEdit={handleCancelEditItem}
                                onSaveEdit={() => handleSaveItemEdit(itm)}
                                onChangeName={setEditItemName}
                                onChangeSpec={setEditItemSpec}
                                onChangeQtyStr={setEditItemQtyStr}
                                onChangeUnit={setEditItemUnit}
                                onAdjustQty={(delta) => setEditItemQtyStr(adjustQty(editItemQtyStr, delta))}
                                onDelete={() => handleDeleteItem(itm, 'production')}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No production items added yet.</p>
                      )}

                      {/* 1. Production Quick Add Presets */}
                      <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus className="w-3 h-3 text-amber-400" />
                            Quick Add Presets
                          </span>
                          <span className="text-[10px] text-zinc-500">Tap to add</span>
                        </div>

                        {/* Presets Grid: Max 2 cols on wider screens, 1-2 on mobile */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* 1. Wooden Platform Flooring (with Carpet) */}
                          <button
                            type="button"
                            onClick={() => setActiveSpecialPanel(activeSpecialPanel === 'flooring' ? 'none' : 'flooring')}
                            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group ${
                              activeSpecialPanel === 'flooring'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                : 'border-dashed border-zinc-700/80 bg-zinc-950/40 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-amber-500/60'
                            }`}
                          >
                            <span>1. Wooden Platform Flooring</span>
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              + Carpet
                            </span>
                          </button>

                          {/* 2. Selfie Booth */}
                          <button
                            type="button"
                            onClick={() => handleQuickAddSimpleItem('production', 'Selfie Booth')}
                            className="min-h-[40px] px-3 py-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/60 hover:border-amber-500/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                          >
                            <span>2. Selfie Booth</span>
                            <Plus className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 group-hover:scale-110 transition-transform" />
                          </button>

                          {/* 3. Table Vinyl Branding */}
                          <button
                            type="button"
                            onClick={() => handleQuickAddSimpleItem('production', 'Table Vinyl Branding')}
                            className="min-h-[40px] px-3 py-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/60 hover:border-amber-500/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                          >
                            <span>3. Table Vinyl Branding</span>
                            <Plus className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 group-hover:scale-110 transition-transform" />
                          </button>

                          {/* 4. TV — 42 inch */}
                          <button
                            type="button"
                            onClick={() => {
                              setTvSize('42 inch');
                              setActiveSpecialPanel(activeSpecialPanel === 'tv' && tvSize === '42 inch' ? 'none' : 'tv');
                            }}
                            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group ${
                              activeSpecialPanel === 'tv' && tvSize === '42 inch'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                : 'border-dashed border-zinc-700/80 bg-zinc-950/40 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-amber-500/60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5 text-amber-400" />
                              <span>4. TV — 42 inch</span>
                            </span>
                            <span className="text-[10px] text-zinc-400">Mount options</span>
                          </button>

                          {/* 5. TV — 50–55 inch */}
                          <button
                            type="button"
                            onClick={() => {
                              setTvSize('50–55 inch');
                              setActiveSpecialPanel(activeSpecialPanel === 'tv' && tvSize === '50–55 inch' ? 'none' : 'tv');
                            }}
                            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group ${
                              activeSpecialPanel === 'tv' && tvSize === '50–55 inch'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                                : 'border-dashed border-zinc-700/80 bg-zinc-950/40 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-amber-500/60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5 text-amber-400" />
                              <span>5. TV — 50–55 inch</span>
                            </span>
                            <span className="text-[10px] text-zinc-400">Mount options</span>
                          </button>
                        </div>

                        {/* Special Panel: Flooring Carpet Color Picker */}
                        {activeSpecialPanel === 'flooring' && (
                          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/40 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-100">
                                Select Carpet Color for Wooden Platform
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveSpecialPanel('none')}
                                className="text-zinc-500 hover:text-zinc-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(['Grey', 'Red', 'Blue'] as const).map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setCarpetColor(color)}
                                  className={`min-h-[42px] p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    carpetColor === color
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                      color === 'Grey' ? 'bg-zinc-400' : color === 'Red' ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                  />
                                  <span>{color}</span>
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveSpecialPanel('none')}
                                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleAddFlooringWithCarpet}
                                className="min-h-[38px] px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                              >
                                Add Flooring + {carpetColor} Carpet
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Special Panel: TV Configuration Picker */}
                        {activeSpecialPanel === 'tv' && (
                          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/40 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                <Tv className="w-4 h-4 text-amber-400" />
                                <span>Configure TV ({tvSize})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveSpecialPanel('none')}
                                className="text-zinc-500 hover:text-zinc-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* TV Size Selector */}
                            <div className="space-y-1">
                              <label className="text-[11px] text-zinc-400 font-medium">TV Size</label>
                              <div className="grid grid-cols-2 gap-2">
                                {(['42 inch', '50–55 inch'] as const).map((sz) => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => setTvSize(sz)}
                                    className={`min-h-[38px] p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                      tvSize === sz
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Installation Type */}
                            <div className="space-y-1">
                              <label className="text-[11px] text-zinc-400 font-medium">Installation Type</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                  { label: 'Wall Mounted (Without Stand)', val: 'Wall Mounted (Without Stand)' as const },
                                  { label: 'With Stand', val: 'With Stand' as const },
                                ].map((opt) => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => setTvMounting(opt.val)}
                                    className={`min-h-[38px] p-2 rounded-lg border text-xs font-semibold text-left flex items-center justify-between transition-all cursor-pointer ${
                                      tvMounting === opt.val
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                    }`}
                                  >
                                    <span>{opt.label}</span>
                                    {tvMounting === opt.val && <Check className="w-3.5 h-3.5 text-amber-400" />}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Quantity Stepper */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">Quantity:</span>
                                <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden min-h-[36px]">
                                  <button
                                    type="button"
                                    onClick={() => setTvQtyStr(adjustQty(tvQtyStr, -1))}
                                    className="px-2.5 py-1 text-zinc-400 hover:text-zinc-100"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={tvQtyStr}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setTvQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-12 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setTvQtyStr(adjustQty(tvQtyStr, 1))}
                                    className="px-2.5 py-1 text-zinc-400 hover:text-zinc-100"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveSpecialPanel('none')}
                                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddTv}
                                  className="min-h-[38px] px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  Add TV
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Custom Production Item Form */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Custom Production Item
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={prodNameInput}
                            onChange={(e) => setProdNameInput(e.target.value)}
                            placeholder="e.g. Acrylic Logo Lettering / Special Arch"
                            className="flex-1 min-h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="text"
                            value={prodSpecInput}
                            onChange={(e) => setProdSpecInput(e.target.value)}
                            placeholder="Specification (optional)"
                            className="sm:w-44 min-h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            {/* Quantity Stepper */}
                            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[42px]">
                              <button
                                type="button"
                                onClick={() => setProdQtyStr(adjustQty(prodQtyStr, -1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={prodQtyStr}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setProdQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => {
                                  if (!prodQtyStr || parseInt(prodQtyStr, 10) < 1) setProdQtyStr('1');
                                }}
                                className="w-14 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setProdQtyStr(adjustQty(prodQtyStr, 1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddCustomItem('production')}
                              className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: REFINED FURNITURE QUICK ADD */}
                  {sec.key === 'furniture' && (
                    <div className="space-y-4">
                      {/* Furniture Items List */}
                      {furnItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Saved Requirements ({furnItems.length})
                          </span>
                          <div className="space-y-1.5">
                            {furnItems.map((itm) => (
                              <ItemRow
                                key={itm.id}
                                item={itm}
                                isEditing={editingItemId === itm.id}
                                editName={editItemName}
                                editSpec={editItemSpec}
                                editQtyStr={editItemQtyStr}
                                editUnit={editItemUnit}
                                isSaving={isSavingItem}
                                onStartEdit={() => handleStartEditItem(itm)}
                                onCancelEdit={handleCancelEditItem}
                                onSaveEdit={() => handleSaveItemEdit(itm)}
                                onChangeName={setEditItemName}
                                onChangeSpec={setEditItemSpec}
                                onChangeQtyStr={setEditItemQtyStr}
                                onChangeUnit={setEditItemUnit}
                                onAdjustQty={(delta) => setEditItemQtyStr(adjustQty(editItemQtyStr, delta))}
                                onDelete={() => handleDeleteItem(itm, 'furniture')}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No furniture items assigned yet.</p>
                      )}

                      {/* 1. Quick Add Presets: Glass Round Table, 1-Seater Sofa, 2-Seater Sofa, Chair */}
                      <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus className="w-3 h-3 text-amber-400" />
                            Quick Add Presets
                          </span>
                          <span className="text-[10px] text-zinc-500">Tap to add Qty 1</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['Glass Round Table', '1-Seater Sofa', '2-Seater Sofa', 'Chair'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleQuickAddSimpleItem('furniture', preset)}
                              className="min-h-[38px] px-3 py-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/60 hover:border-amber-500/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                            >
                              <span>{preset}</span>
                              <Plus className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 group-hover:scale-110 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Custom Furniture Item Form */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Custom Furniture Item
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={furnNameInput}
                            onChange={(e) => setFurnNameInput(e.target.value)}
                            placeholder="e.g. Brochure Stand, Counter, Stool"
                            className="flex-1 min-h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            {/* Quantity Stepper */}
                            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[42px]">
                              <button
                                type="button"
                                onClick={() => setFurnQtyStr(adjustQty(furnQtyStr, -1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={furnQtyStr}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setFurnQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => {
                                  if (!furnQtyStr || parseInt(furnQtyStr, 10) < 1) setFurnQtyStr('1');
                                }}
                                className="w-14 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setFurnQtyStr(adjustQty(furnQtyStr, 1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddCustomItem('furniture')}
                              className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2 bg-emerald-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 5: REFINED ELECTRICAL QUICK ADD */}
                  {sec.key === 'electrical' && (
                    <div className="space-y-4">
                      {/* Electrical Items List */}
                      {elecItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Saved Requirements ({elecItems.length})
                          </span>
                          <div className="space-y-1.5">
                            {elecItems.map((itm) => (
                              <ItemRow
                                key={itm.id}
                                item={itm}
                                isEditing={editingItemId === itm.id}
                                editName={editItemName}
                                editSpec={editItemSpec}
                                editQtyStr={editItemQtyStr}
                                editUnit={editItemUnit}
                                isSaving={isSavingItem}
                                onStartEdit={() => handleStartEditItem(itm)}
                                onCancelEdit={handleCancelEditItem}
                                onSaveEdit={() => handleSaveItemEdit(itm)}
                                onChangeName={setEditItemName}
                                onChangeSpec={setEditItemSpec}
                                onChangeQtyStr={setEditItemQtyStr}
                                onChangeUnit={setEditItemUnit}
                                onAdjustQty={(delta) => setEditItemQtyStr(adjustQty(editItemQtyStr, delta))}
                                onDelete={() => handleDeleteItem(itm, 'electrical')}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No electrical items assigned yet.</p>
                      )}

                      {/* 1. Quick Add Presets: Power Socket, Pelmet Light */}
                      <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus className="w-3 h-3 text-amber-400" />
                            Quick Add Presets
                          </span>
                          <span className="text-[10px] text-zinc-500">Tap to add Qty 1</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {['Power Socket', 'Pelmet Light'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleQuickAddSimpleItem('electrical', preset)}
                              className="min-h-[38px] px-3 py-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/60 hover:border-amber-500/60 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                            >
                              <span>{preset}</span>
                              <Plus className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 group-hover:scale-110 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Custom Electrical Item Form */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Custom Electrical Item
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={elecNameInput}
                            onChange={(e) => setElecNameInput(e.target.value)}
                            placeholder="e.g. 15A Power Point / LED Track Light"
                            className="flex-1 min-h-[42px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            {/* Quantity Stepper */}
                            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[42px]">
                              <button
                                type="button"
                                onClick={() => setElecQtyStr(adjustQty(elecQtyStr, -1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={elecQtyStr}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setElecQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => {
                                  if (!elecQtyStr || parseInt(elecQtyStr, 10) < 1) setElecQtyStr('1');
                                }}
                                className="w-14 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setElecQtyStr(adjustQty(elecQtyStr, 1))}
                                className="px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddCustomItem('electrical')}
                              className="flex-1 sm:flex-initial min-h-[42px] px-5 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal: Delete Flooring with Associated Carpet */}
      <Modal
        isOpen={flooringDeletePrompt !== null}
        onClose={() => setFlooringDeletePrompt(null)}
        title="Remove Flooring & Carpet"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Wooden Platform Flooring is linked with the Carpet requirement. Do you also want to remove the Carpet item?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setFlooringDeletePrompt(null)}
              className="w-full sm:w-auto px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirmFlooringDelete(false)}
              className="w-full sm:w-auto px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-medium cursor-pointer"
            >
              Keep Carpet
            </button>
            <button
              type="button"
              onClick={() => handleConfirmFlooringDelete(true)}
              className="w-full sm:w-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold cursor-pointer"
            >
              Remove Both
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Booth Modal */}
      <EditBoothModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        booth={booth}
        onSuccess={async (updated) => {
          setBooth(updated);
          setIsEditModalOpen(false);
          showToast('Booth details updated.');
          await loadAllData();
        }}
      />

      {/* Delete Stall Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        type="stall"
        itemName={`Stall #${booth.booth_number} — ${booth.client_name}`}
        itemSubtext={`${booth.event_name || 'Exhibition'} • ${booth.stand_size || ''}`}
        onConfirmDelete={async () => {
          await deleteBooth(boothId);
          setIsDeleteModalOpen(false);
          onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
        }}
        onArchiveInstead={async () => {
          await archiveBooth(boothId);
          setIsDeleteModalOpen(false);
          onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
        }}
      />

      {/* Archive Stall Confirmation Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive booth{' '}
            <span className="font-bold text-zinc-100">{booth.booth_number}</span> (
            {booth.client_name})?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await archiveBooth(boothId);
                setIsArchiveConfirmOpen(false);
                onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl cursor-pointer"
            >
              Archive Booth
            </button>
          </div>
        </div>
      </Modal>

      {/* Floor Plan Viewer Modal */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        eventId={booth.event_id}
        eventName={booth.event_name || 'Exhibition Floor Plan'}
        pdfUrl={booth.event_floor_plan_url || null}
        highlightStall={booth.booth_number}
        onUpdatePdfUrl={async (newUrl) => {
          if (booth.event_id) {
            await updateEvent(booth.event_id, { floor_plan_url: newUrl });
            await loadAllData();
          }
        }}
      />

      {/* Confirm Stall Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Exhibition Stall"
        subtitle="Convert ongoing discussion into an active confirmed project"
        maxWidth="max-w-[460px]"
      >
        <form onSubmit={handleConfirmStallSubmit} className="space-y-4 text-xs" noValidate>
          {confirmError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{confirmError}</span>
            </div>
          )}

          <div className="bg-[#1c1f2a] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Company:</span>
              <span className="font-bold text-zinc-100 text-xs">{booth.client_name}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Exhibition:</span>
              <span className="font-medium text-zinc-200">{booth.event_name || 'Selected Exhibition'}</span>
            </div>
            {booth.phone && (
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Contact:</span>
                <span className="font-mono text-zinc-300">{booth.phone}</span>
              </div>
            )}
            {booth.discussion_remark && (
              <div className="text-zinc-400 text-[11px] pt-1 border-t border-white/[0.04]">
                <span className="text-zinc-500 block">Discussion Remark:</span>
                <span className="italic text-zinc-300">"{booth.discussion_remark}"</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">
              Allot Stall / Booth Number <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={confirmStallNumber}
              onChange={(e) => setConfirmStallNumber(e.target.value)}
              placeholder="e.g. A-12, B-05, D-02..."
              className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>What happens upon confirmation:</span>
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-0.5 pl-1">
              <li>Initializes the 5-section production & design checklist.</li>
              <li>Moves this stall to the Confirmed Stalls directory.</li>
              <li>Updates dashboard statistics immediately.</li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={confirmSubmitting}
              className="px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {confirmSubmitting ? (
                <span>Confirming...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm Stall</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Print Checklist Modal */}
      <PrintChecklistModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`Stall #${booth.booth_number} — ${booth.client_name}`}
        subtitle={`${booth.event_name || 'Exhibition'} • ${getStallTypeLabel(booth.booth_type)} (${booth.stand_size || '3 × 3 m'})`}
        stalls={[
          {
            booth,
            eventName: booth.event_name || 'Exhibition',
            tasks,
            productionItems: prodItems,
            furnitureItems: furnItems,
            electricalItems: elecItems,
            goodiesItems,
            views3D,
          },
        ]}
      />

      {/* Client Stall Details Share Modal */}
      <ShareStallModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        booth={booth}
        eventName={booth.event_name || 'Exhibition'}
        views3D={views3D}
        productionItems={prodItems}
        furnitureItems={furnItems}
        electricalItems={elecItems}
        goodiesItems={goodiesItems}
      />

      {/* 3D Image Full-size Preview Lightbox Modal */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] bg-zinc-900 border border-zinc-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm font-semibold text-zinc-100 truncate" title={previewModalImg.title || '3D Design Preview'}>
                  {previewModalImg.title || '3D Design Preview'}
                </span>
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 shrink-0">
                  {booth.booth_number}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewModalImg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  title="Open image in a new tab"
                >
                  <span>Open Full Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalImg(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-2 sm:p-6 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[260px] max-h-[calc(92vh-60px)]">
              {modalImgError ? (
                <div className="flex flex-col items-center justify-center p-6 text-center max-w-md my-auto">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-100 mb-1">Preview Image Unavailable</h4>
                  <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                    The 3D preview image could not be loaded from <span className="font-mono text-zinc-300 break-all">{previewModalImg.url}</span>.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setModalImgError(false);
                        setModalImgRetryKey((k) => k + 1);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <a
                      href={previewModalImg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Link Directly</span>
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  key={modalImgRetryKey}
                  src={modalImgRetryKey ? `${previewModalImg.url}${previewModalImg.url.includes('?') ? '&' : '?'}t=${modalImgRetryKey}` : previewModalImg.url}
                  alt={previewModalImg.title || '3D Preview'}
                  className="max-w-full max-h-[78vh] w-auto h-auto object-contain rounded-lg shadow-2xl transition-all"
                  onError={() => setModalImgError(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ItemRow with Inline Editing Support
// ---------------------------------------------------------------------------
interface ItemRowProps {
  item: BoothItemRecord;
  isEditing: boolean;
  editName: string;
  editSpec: string;
  editQtyStr: string;
  editUnit: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onChangeName: (val: string) => void;
  onChangeSpec: (val: string) => void;
  onChangeQtyStr: (val: string) => void;
  onChangeUnit: (val: string) => void;
  onAdjustQty: (delta: number) => void;
  onDelete: () => void;
}

function ItemRow({
  item,
  isEditing,
  editName,
  editSpec,
  editQtyStr,
  editUnit,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeName,
  onChangeSpec,
  onChangeQtyStr,
  onChangeUnit,
  onAdjustQty,
  onDelete,
}: ItemRowProps) {
  if (isEditing) {
    const isCarpetItem = item.item_name.toLowerCase().includes('carpet');
    const isTvItem = item.item_name.toLowerCase().includes('tv');

    return (
      <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/40 space-y-2.5 animate-in fade-in duration-100">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Item name"
            className="flex-1 min-h-[38px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          />

          {/* Quick Specification Editor: Color for Carpet, Mounting for TV, or Text */}
          {isCarpetItem ? (
            <div className="flex items-center gap-1.5">
              {(['Grey', 'Red', 'Blue'] as const).map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() => onChangeSpec(`Color: ${clr}`)}
                  className={`px-2 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
                    editSpec.includes(clr)
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {clr}
                </button>
              ))}
            </div>
          ) : isTvItem ? (
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Wall Mount', val: 'Wall Mounted (Without Stand)' },
                { label: 'With Stand', val: 'With Stand' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => onChangeSpec(opt.val)}
                  className={`px-2 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
                    editSpec === opt.val
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={editSpec}
              onChange={(e) => onChangeSpec(e.target.value)}
              placeholder="Specification (optional)"
              className="sm:w-44 min-h-[38px] bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          )}

          <div className="flex items-center gap-2">
            {/* Inline Stepper */}
            <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden min-h-[38px]">
              <button
                type="button"
                onClick={() => onAdjustQty(-1)}
                className="px-2.5 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Decrease"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editQtyStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChangeQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-12 bg-transparent text-center text-xs text-zinc-100 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onAdjustQty(1)}
                className="px-2.5 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Increase"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Save & Cancel Buttons */}
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveEdit}
              className="min-h-[38px] px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Save Item"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? '...' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[38px] px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-600/70 text-xs gap-2 transition-colors">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <span
          className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5"
          title="Added to requirements list"
        >
          <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[2.5]" />
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-zinc-100 truncate text-[13px]">{item.item_name}</span>
          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
            <span className="font-mono text-zinc-300 font-medium">Qty: {item.quantity}</span>
            {item.specification && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-amber-300/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-normal truncate max-w-[280px]">
                  {item.specification}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onStartEdit}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-700/60 rounded-lg transition-colors cursor-pointer"
          title="Edit Item"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/60 rounded-lg transition-colors cursor-pointer"
          title="Delete Item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
