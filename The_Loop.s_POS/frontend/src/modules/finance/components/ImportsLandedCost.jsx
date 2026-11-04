import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  Plus, 
  Scale, 
  DollarSign, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  ChevronRight,
  TrendingUp,
  Percent,
  Sparkles,
  Anchor,
  Truck,
  ShieldAlert,
  Edit3,
  Trash2,
  Plane,
  History,
  Barcode,
  Printer,
  UploadCloud,
  RefreshCw,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckCircle2,
  X
} from 'lucide-react';
import { api, formatMoney, formatUnitCost, formatPercent } from '../api';
import ConfirmModal from './ConfirmModal';
import ImportHistoryView from '../../../components/admin/ImportHistoryView';
import { usePos } from '../../../context/PosContext';

function ItemImagePicker({ imageUrl, onImageChange }) {
  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const samplePresets = [
    { name: 'Tech', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
    { name: 'Bag', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80' },
    { name: 'Beauty', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80' },
    { name: 'Jewelry', url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80' },
    { name: 'Notebook', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80' },
    { name: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80' },
    { name: 'Apparel', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&q=80' },
    { name: 'Mug', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&q=80' }
  ];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ image: base64, filename: file.name })
          });
          const data = await res.json();
          if (res.ok && data.ok && data.url) {
            onImageChange(data.url);
          } else {
            onImageChange(base64);
          }
        } catch (err) {
          onImageChange(base64);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg('Failed to read file: ' + err.message);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFile}
        className="hidden"
      />

      <div className="flex items-center space-x-1.5 text-[11px] font-mono tracking-wider text-amber-400 uppercase font-bold">
        <ImageIcon className="w-3.5 h-3.5" />
        <span>PRODUCT PICTURE / PHOTO</span>
      </div>

      {imageUrl ? (
        <div className="relative group w-full h-44 rounded-2xl overflow-hidden border border-amber-500/30 bg-black/60 flex items-center justify-center">
          <img
            src={imageUrl}
            alt="Product Preview"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={(e) => { e.target.style.opacity = '0.5'; }}
          />
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-400 flex items-center space-x-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Image Attached</span>
          </div>
          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition"
              title="Replace picture from computer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={() => onImageChange('')}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
              title="Remove picture"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) handleFile({ target: { files: e.dataTransfer.files } });
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full py-7 px-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer text-center select-none ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
              : 'border-amber-500/40 hover:border-amber-400 bg-black/40 hover:bg-black/60'
          }`}
        >
          {uploading ? (
            <div className="space-y-2 flex flex-col items-center">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="text-xs font-mono text-slate-300">Uploading picture...</span>
            </div>
          ) : (
            <div className="space-y-2 flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                Drag & drop product picture here, or <span className="text-amber-400 underline font-extrabold">browse</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Supports JPG, PNG, WEBP (Max 5MB)
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Fallback & Sample Presets */}
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center space-x-1 underline font-mono transition"
          >
            <LinkIcon className="w-3 h-3" />
            <span>{showUrlInput ? 'Hide web URL input' : 'Or paste image URL (https://...)'}</span>
          </button>
        </div>

        {showUrlInput && (
          <div className="flex gap-2 animate-in fade-in">
            <input
              type="url"
              placeholder="https://example.com/images/product.jpg"
              value={imageUrl || ''}
              onChange={(e) => onImageChange(e.target.value)}
              className="flex-1 bg-[#111520] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-slate-500 font-mono">Sample Presets:</span>
          {samplePresets.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => onImageChange(p.url)}
              className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 hover:border-amber-400/30 transition text-[10px] font-mono"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

export default function ImportsLandedCost({ mode, onShowToast, initialSubTab = 'active' }) {
  const { currentUser } = usePos();
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPER_ADMIN';
  const canImport = isOwner || currentUser?.permissions?.importData === true || currentUser?.permissions?.importProducts === true;

  const [subTab, setSubTab] = useState(initialSubTab);
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('ship-worked-001');
  const [shipmentDetails, setShipmentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Reusable Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    variant: 'primary',
    details: [],
    confirmText: 'Confirm',
    onConfirm: null,
    isLoading: false
  });
  const [shippingCategories, setShippingCategories] = useState([]);
  const [isPushingStock, setIsPushingStock] = useState(false);

  // Modal for editing existing shipment
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    shipmentCode: '',
    supplierName: '',
    originCountry: 'China',
    shippingTerms: 'FOB',
    shippingCategory: 'Air Shipping',
    exchangeRate: '1.0',
    notes: '',
    items: []
  });

  // Modal for adding overhead fee
  const [isOverheadModalOpen, setIsOverheadModalOpen] = useState(false);
  const [overheadForm, setOverheadForm] = useState({
    category: 'INTERNATIONAL_FREIGHT',
    vendorName: '',
    invoiceNumber: '',
    amount: '',
    allocationBasis: 'BY_WEIGHT',
    isCapitalizable: true
  });

  // Modal for editing overhead fee
  const [isEditOverheadModalOpen, setIsEditOverheadModalOpen] = useState(false);
  const [editOverheadForm, setEditOverheadForm] = useState({
    id: '',
    category: 'INTERNATIONAL_FREIGHT',
    vendorName: '',
    invoiceNumber: '',
    amount: '',
    allocationBasis: 'BY_WEIGHT',
    isCapitalizable: true
  });

  // Modal for new shipment
  const generateShipmentCode = () => {
    const yr = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `IMP-${yr}-${rand}`;
  };

  const generateAutoSku = (cat = 'GEN') => {
    const seed = (cat || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BV-${seed}-${rand}`;
  };

  const generateAutoBarcode = () => {
    const rand9 = Math.floor(100000000 + Math.random() * 900000000);
    return `880${rand9}`;
  };

  const createBlankItem = (index = 1, cat = '') => ({
    productName: '',
    skuCode: generateAutoSku(cat),
    barcode: generateAutoBarcode(),
    category: cat || '',
    quantity: '',
    unitBasePrice: '',
    unitWeightKg: 0.5,
    unitVolumeCbm: 0.001,
    targetRetailPrice: '',
    imageUrl: ''
  });

  const [isNewShipmentModalOpen, setIsNewShipmentModalOpen] = useState(false);
  const [newShipmentForm, setNewShipmentForm] = useState({
    shipmentCode: generateShipmentCode(),
    supplierName: '',
    originCountry: 'China',
    shippingTerms: 'FOB',
    shippingCategory: '',
    exchangeRate: '1.0',
    items: [createBlankItem(1)],
    overheads: []
  });

  const handleOpenNewShipmentModal = () => {
    setNewShipmentForm({
      shipmentCode: generateShipmentCode(),
      supplierName: '',
      originCountry: 'China',
      shippingTerms: 'FOB',
      shippingCategory: '',
      exchangeRate: '1.0',
      items: [createBlankItem(1)],
      overheads: []
    });
    setIsNewShipmentModalOpen(true);
  };

  useEffect(() => {
    loadShipments();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const [prodData, shipData] = await Promise.all([
        api.getCategories().catch(() => []),
        api.getShippingCategories().catch(() => [])
      ]);
      setCategories(Array.isArray(prodData) ? prodData : []);
      setShippingCategories(Array.isArray(shipData) ? shipData : []);
    } catch (e) {
      console.warn('Failed to load categories:', e);
    }
  };

  useEffect(() => {
    if (selectedShipmentId) {
      loadDetails(selectedShipmentId);
    }
  }, [selectedShipmentId]);

  const loadShipments = async () => {
    try {
      const data = await api.getShipments();
      setShipments(data);
      if (data.length > 0 && !selectedShipmentId) {
        setSelectedShipmentId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id) => {
    try {
      const details = await api.getShipmentDetails(id);
      setShipmentDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOverhead = async (e) => {
    e.preventDefault();
    try {
      await api.addShipmentOverhead(selectedShipmentId, overheadForm);
      setIsOverheadModalOpen(false);
      setOverheadForm({
        category: 'INTERNATIONAL_FREIGHT',
        vendorName: '',
        invoiceNumber: '',
        amount: '',
        allocationBasis: 'BY_WEIGHT',
        isCapitalizable: true
      });
      onShowToast('Overhead fee added & redistributed across items!', 'success');
      loadDetails(selectedShipmentId);
      loadShipments();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleOpenEditOverhead = (ovh) => {
    setEditOverheadForm({
      id: ovh.id,
      category: ovh.category || 'INTERNATIONAL_FREIGHT',
      vendorName: ovh.vendorName || '',
      invoiceNumber: ovh.invoiceNumber || '',
      amount: String(ovh.amountBase || ovh.amountForeign || ''),
      allocationBasis: ovh.allocationBasis || 'BY_WEIGHT',
      isCapitalizable: ovh.isCapitalizable !== false
    });
    setIsEditOverheadModalOpen(true);
  };

  const handleSaveEditOverhead = async (e) => {
    e.preventDefault();
    try {
      await api.updateShipmentOverhead(selectedShipmentId, editOverheadForm.id, editOverheadForm);
      setIsEditOverheadModalOpen(false);
      onShowToast(`Overhead invoice for "${editOverheadForm.vendorName}" updated & redistributed!`, 'success');
      loadDetails(selectedShipmentId);
      loadShipments();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteOverhead = (overheadId) => {
    const ovh = shipmentDetails?.overheads?.find(o => o.id === overheadId);
    setConfirmConfig({
      isOpen: true,
      title: 'Remove Overhead Expense Invoice',
      subtitle: 'This overhead fee will be removed from this shipment and deducted from unit landed costs.',
      variant: 'danger',
      details: [
        { label: 'Cost Category', value: ovh?.costCategory || 'Overhead Fee' },
        { label: 'Vendor / Provider', value: ovh?.vendorName || 'Vendor' },
        { label: 'Amount', value: formatMoney(ovh?.amountBase || 0), highlight: true },
        { label: 'Allocation Method', value: ovh?.allocationMethod || 'VALUE' }
      ],
      confirmText: 'Remove Overhead',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.deleteShipmentOverhead(selectedShipmentId, overheadId);
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Overhead invoice removed & landed costs recalculated!', 'success');
          loadDetails(selectedShipmentId);
          loadShipments();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleFinalize = () => {
    const shp = shipmentDetails?.shipment;
    setConfirmConfig({
      isOpen: true,
      title: 'Finalize Landed Cost & Post to Ledger',
      subtitle: 'This will lock unit landed costs and create balanced capitalization journals in the General Ledger (Dr 1200 Inventory Asset, Cr 2010 AP / Cash).',
      variant: 'success',
      details: [
        { label: 'Shipment Code', value: shp?.shipmentCode || selectedShipmentId, highlight: true },
        { label: 'Supplier / Factory', value: shp?.supplierName || '' },
        { label: 'Total Landed Cost', value: formatMoney(shp?.totalLandedCost || 0), highlight: true },
        { label: 'Product Items', value: `${shipmentDetails?.items?.length || 0} SKUs` }
      ],
      confirmText: 'Confirm & Post to Ledger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.finalizeShipment(selectedShipmentId);
          // Also automatically push landed costs and inventory to Stock Loops
          try {
            await api.pushLandedCostsToStock(selectedShipmentId);
          } catch(e) {}
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Landed cost finalized! Stock received into Stock Management & published to POS catalog!', 'success');
          loadDetails(selectedShipmentId);
          loadShipments();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handlePushToStock = () => {
    if (!selectedShipmentId) return;
    const shp = shipmentDetails?.shipment;
    setConfirmConfig({
      isOpen: true,
      title: 'Push Landed Costs to Stock Management',
      subtitle: `Push calculated landed costs for shipment ${shp?.shipmentCode || selectedShipmentId} to Stock Loops (Port 3000)?`,
      variant: 'primary',
      details: [
        { label: 'Shipment Code', value: shp?.shipmentCode || selectedShipmentId, highlight: true },
        { label: 'Items to Push', value: `${shipmentDetails?.items?.length || 0} products` },
        { label: 'Target System', value: 'Stock Management Loops (Port 3000)' }
      ],
      confirmText: 'Push to Stock Loops',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        setIsPushingStock(true);
        try {
          const res = await api.pushLandedCostsToStock(selectedShipmentId);
          const catMsg = (res.createdCategories && res.createdCategories.length > 0)
            ? ` Auto-created ${res.createdCategories.length} categories on Stock: ${res.createdCategories.join(', ')}.`
            : '';
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast(`Pushed to Stock Loops! Updated ${res.updatedCount || 0} items, created ${res.createdCount || 0} items.${catMsg}`, 'success');
          loadDetails(selectedShipmentId);
          loadShipments();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        } finally {
          setIsPushingStock(false);
        }
      }
    });
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    try {
      if (!newShipmentForm.supplierName || !newShipmentForm.supplierName.trim()) {
        onShowToast('Please provide a Supplier / Factory name.', 'error');
        return;
      }

      // Filter and clean items: require at least one with a product name
      const validItems = newShipmentForm.items.filter(it => it.productName && it.productName.trim());
      if (validItems.length === 0) {
        onShowToast('Please enter at least one product name in the shipment.', 'error');
        return;
      }

      const cleanedItems = validItems.map((it, idx) => {
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        const buyCost = Number(it.unitBasePrice) >= 0 ? Number(it.unitBasePrice) : 0;
        const sellPrice = Number(it.targetRetailPrice) >= 0 ? Number(it.targetRetailPrice) : (buyCost > 0 ? buyCost * 1.5 : 0);
        const sku = (it.skuCode && it.skuCode.trim()) || generateAutoSku(it.category, it.productName);
        const bcode = (it.barcode && it.barcode.trim()) || generateAutoBarcode();
        return {
          productName: it.productName.trim(),
          skuCode: sku,
          barcode: bcode,
          category: it.category ? it.category.trim() : 'General',
          quantity: qty,
          unitBasePrice: buyCost,
          unitWeightKg: Number(it.unitWeightKg) || 0.5,
          unitVolumeCbm: Number(it.unitVolumeCbm) || 0.001,
          targetRetailPrice: sellPrice,
          imageUrl: it.imageUrl ? it.imageUrl.trim() : ''
        };
      });

      const shipmentCode = (newShipmentForm.shipmentCode && newShipmentForm.shipmentCode.trim()) || generateShipmentCode();

      const res = await api.createShipment({
        shipment: {
          shipmentCode,
          supplierName: newShipmentForm.supplierName.trim(),
          originCountry: newShipmentForm.originCountry || 'China',
          shippingTerms: newShipmentForm.shippingTerms || 'FOB',
          shippingCategory: newShipmentForm.shippingCategory || '',
          exchangeRate: Number(newShipmentForm.exchangeRate) || 1.0
        },
        items: cleanedItems,
        overheads: newShipmentForm.overheads || []
      });

      setIsNewShipmentModalOpen(false);
      onShowToast(`Import shipment ${shipmentCode} created successfully!`, 'success');
      await loadShipments();
      if (res && res.shipment && res.shipment.id) {
        setSelectedShipmentId(res.shipment.id);
        await loadDetails(res.shipment.id);
      }
    } catch (err) {
      console.error('Shipment creation error:', err);
      onShowToast(err.message || 'Failed to create import shipment', 'error');
    }
  };

  const handleOpenEdit = () => {
    if (!shipmentDetails) return;
    setEditForm({
      shipmentCode: shipmentDetails.shipment.shipmentCode || '',
      supplierName: shipmentDetails.shipment.supplierName || '',
      originCountry: shipmentDetails.shipment.originCountry || 'China',
      shippingTerms: shipmentDetails.shipment.shippingTerms || 'FOB',
      shippingCategory: shipmentDetails.shipment.shippingCategory || 'Air Shipping',
      exchangeRate: String(shipmentDetails.shipment.exchangeRate || 1.0),
      notes: shipmentDetails.shipment.notes || '',
      items: (shipmentDetails.items || []).map(i => ({
        id: i.id,
        productName: i.productName || '',
        skuCode: i.skuCode || '',
        category: i.category || '',
        quantity: i.quantity || 1,
        unitBasePrice: i.unit_base_price_fc || i.unit_base_price_base || 0,
        targetRetailPrice: i.target_retail_price || 0,
        unitWeightKg: i.unit_weight_kg || 0.5,
        unitVolumeCbm: i.unit_volume_cbm || 0.002,
        imageUrl: i.imageUrl || ''
      }))
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.updateShipment(selectedShipmentId, {
        shipment: {
          shipmentCode: editForm.shipmentCode,
          supplierName: editForm.supplierName,
          originCountry: editForm.originCountry,
          shippingTerms: editForm.shippingTerms,
          shippingCategory: editForm.shippingCategory,
          exchangeRate: Number(editForm.exchangeRate) || 1.0,
          notes: editForm.notes
        },
        items: editForm.items
      });
      setIsEditModalOpen(false);
      onShowToast(`Shipment ${editForm.shipmentCode} updated & landed cost recalculated!`, 'success');
      loadShipments();
      loadDetails(selectedShipmentId);
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteShipment = (id) => {
    const shp = shipments.find(s => s.id === id);
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Import Shipment',
      subtitle: 'Are you sure you want to permanently delete this import shipment? This cannot be undone.',
      variant: 'danger',
      details: [
        { label: 'Shipment Code', value: shp?.shipmentCode || id, highlight: true },
        { label: 'Supplier / Factory', value: shp?.supplierName || 'Unknown' },
        { label: 'Status', value: shp?.status || 'DRAFT' }
      ],
      confirmText: 'Delete Shipment',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.deleteShipment(id);
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Shipment removed.', 'success');
          setSelectedShipmentId(null);
          loadShipments();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card p-6 border border-[#E5A93C]/20 bg-gradient-to-r from-[#E5A93C]/10 via-transparent to-transparent flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E5A93C] text-black uppercase">
              Core Engine
            </span>
            <span className="text-xs text-slate-400">Section 4 of Loops Finance V3</span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Ship className="w-5 h-5 text-[#E5A93C]" />
            Import Product Cost & Landed Cost Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Distribute international freight, customs duties, port clearance, and inland trucking across incoming SKUs by Weight, Value, Volume (CBM) or Quantity. Computes true unit landed cost to guarantee real profitability.
          </p>
        </div>

        {canImport && subTab === 'active' && (
          <button
            onClick={handleOpenNewShipmentModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#F3C368] text-black text-xs font-bold transition shadow-lg shadow-[#E5A93C]/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Import Shipment</span>
          </button>
        )}
      </div>

      {/* Sub-Navigation: Active Landed Costs vs Import History Archive */}
      <div className="flex items-center gap-2 border-b border-obsidian-800 pb-2">
        <button
          onClick={() => setSubTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'active'
              ? 'bg-[#E5A93C] text-obsidian-950 shadow-md shadow-[#E5A93C]/20'
              : 'glass-card border border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Ship className="w-4 h-4" />
          <span>Active Landed Costs & Shipments</span>
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'history'
              ? 'bg-[#E5A93C] text-obsidian-950 shadow-md shadow-[#E5A93C]/20'
              : 'glass-card border border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Import History Archive</span>
        </button>
      </div>

      {subTab === 'active' ? (
        /* Main Split: Shipment Selector & Detailed Landed Cost Allocator */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Col: Shipments Pipeline List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Import Batches ({shipments.length})
          </h3>

          <div className="space-y-2">
            {shipments.map((s) => {
              const isSelected = s.id === selectedShipmentId;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedShipmentId(s.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#171D2D] border-[#E5A93C] shadow-md'
                      : 'glass-card border-white/5 hover:border-white/20 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-white">{s.shipmentCode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      s.status === 'FINALIZED'
                        ? 'bg-[#10B981]/20 text-[#10B981]'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate font-medium">
                    {s.supplierName}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px]">
                    <span className="text-slate-400">{s.itemCount || 0} SKUs</span>
                    <span className="num-font text-white font-bold">{formatMoney(s.totalLandedCostBase || s.totalGoodsCostBase || 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* V3 Worked Example Benchmark Callout */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-[#E5A93C] font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Verified Spec Example
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Shipment <span className="text-white font-mono">IMP-2026-001</span> demonstrates:
              <br />• Product A (500 units): <strong>$11.77</strong> landed
              <br />• Product B (1,000 units): <strong>$3.82</strong> landed
              <br />• Sum of allocations = $2,700 exact.
            </p>
          </div>
        </div>

        {/* Right 3 Cols: Detailed Landed Cost Studio */}
        <div className="lg:col-span-3 space-y-6">
          {shipmentDetails ? (
            <>
              {/* Shipment Header Details */}
              <div className="glass-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">
                        {shipmentDetails.shipment.shipmentCode}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/30">
                        {shipmentDetails.shipment.shippingTerms} Terms
                      </span>
                      {shipmentDetails.shipment.shippingCategory && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                          {shipmentDetails.shipment.shippingCategory.toLowerCase().includes('sea') ? (
                            <Ship className="w-3 h-3" />
                          ) : shipmentDetails.shipment.shippingCategory.toLowerCase().includes('truck') ? (
                            <Truck className="w-3 h-3" />
                          ) : (
                            <Plane className="w-3 h-3" />
                          )}
                          {shipmentDetails.shipment.shippingCategory}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">Origin: {shipmentDetails.shipment.originCountry}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Supplier: <strong className="text-white">{shipmentDetails.shipment.supplierName}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition"
                      title="Edit shipment details, products or categories"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#E5A93C]" />
                      Edit Import Data
                    </button>

                    <button
                      onClick={() => setIsOverheadModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E5A93C]" />
                      Add Overhead Bill
                    </button>

                    {shipmentDetails.shipment.status !== 'FINALIZED' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFinalize}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-black text-xs font-bold transition shadow-md shadow-[#10B981]/20"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Finalize & Post to Ledger
                        </button>
                        <button
                          onClick={handlePushToStock}
                          disabled={isPushingStock}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5A93C]/20 hover:bg-[#E5A93C]/30 text-[#E5A93C] border border-[#E5A93C]/40 text-xs font-bold transition disabled:opacity-50"
                          title="Push Landed Costs & Items to Stock Loops"
                        >
                          <Layers className={`w-3.5 h-3.5 ${isPushingStock ? 'animate-spin' : ''}`} />
                          {isPushingStock ? 'Pushing...' : 'Push to Stock'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] text-xs font-bold border border-[#10B981]/30">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Cost Locked & Posted
                        </span>
                        <button
                          onClick={handlePushToStock}
                          disabled={isPushingStock}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5A93C]/20 hover:bg-[#E5A93C]/30 text-[#E5A93C] border border-[#E5A93C]/40 text-xs font-bold transition disabled:opacity-50"
                          title="Push Landed Costs & Provision Categories to Stock Loops"
                        >
                          <Layers className={`w-3.5 h-3.5 ${isPushingStock ? 'animate-spin' : ''}`} />
                          {isPushingStock ? 'Pushing...' : 'Push to Stock Loops'}
                        </button>
                      </div>
                    )}

                    {shipmentDetails.shipment.status !== 'FINALIZED' && (
                      <button
                        onClick={() => handleDeleteShipment(selectedShipmentId)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition"
                        title="Delete this shipment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Summary Financial Metric Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-center">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Factory Invoice (Goods)</div>
                    <div className="text-lg font-bold num-font text-white">
                      {formatMoney(shipmentDetails.summary.totalGoodsCost)}
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Allocated Overheads</div>
                    <div className="text-lg font-bold num-font text-[#E5A93C]">
                      +{formatMoney(shipmentDetails.summary.totalOverheadCost)}
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">True Landed Total</div>
                    <div className="text-lg font-bold num-font text-[#10B981]">
                      ={formatMoney(shipmentDetails.summary.totalLandedCost)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items & Landed Cost Distribution Matrix */}
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-[#E5A93C]" />
                      SKU Variant Landed Cost Breakdown
                    </h4>
                    <p className="text-xs text-slate-400">
                      Exact per-unit cost calculated to 4 decimal precision.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {shipmentDetails.items.length} Product Variants
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111520] text-slate-400 border-b border-white/10 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">SKU / Product</th>
                        <th className="py-3 px-3 text-right">Qty</th>
                        <th className="py-3 px-3 text-right">Factory Base</th>
                        <th className="py-3 px-3 text-right">Freight (Sea/Air)</th>
                        <th className="py-3 px-3 text-right">Customs Duty</th>
                        <th className="py-3 px-3 text-right">Port / Clearance</th>
                        <th className="py-3 px-3 text-right">Local Drayage</th>
                        <th className="py-3 px-3 text-right font-bold text-[#E5A93C]">Total Landed</th>
                        <th className="py-3 px-3 text-right font-bold text-[#10B981]">Unit Landed</th>
                        <th className="py-3 px-3 text-right">Selling Price</th>
                        <th className="py-3 px-4 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {shipmentDetails.items.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0 bg-black/40" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs shrink-0">📦</div>
                              )}
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{item.productName}</span>
                                  {item.category && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/20 font-medium">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {item.skuCode} • {item.variantName || 'Standard'} • {item.unit_weight_kg}kg • {item.unit_volume_cbm} CBM
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right num-font font-medium text-slate-200">
                            {item.quantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right num-font text-slate-300">
                            {formatMoney(item.unit_base_price_base)}
                          </td>
                          <td className="py-3 px-3 text-right num-font text-slate-400">
                            +{formatMoney(item.allocated_freight)}
                          </td>
                          <td className="py-3 px-3 text-right num-font text-slate-400">
                            +{formatMoney(item.allocated_duty)}
                          </td>
                          <td className="py-3 px-3 text-right num-font text-slate-400">
                            +{formatMoney(item.allocated_clearance)}
                          </td>
                          <td className="py-3 px-3 text-right num-font text-slate-400">
                            +{formatMoney(item.allocated_trucking)}
                          </td>
                          <td className="py-3 px-3 text-right num-font font-bold text-[#E5A93C]">
                            {formatMoney(item.total_landed_cost)}
                          </td>
                          <td className="py-3 px-3 text-right num-font font-bold text-[#10B981] bg-[#10B981]/5">
                            {formatUnitCost(item.unit_landed_cost)}
                          </td>
                          <td className="py-3 px-3 text-right num-font font-medium text-slate-200">
                            {formatMoney(item.target_retail_price || 0)}
                          </td>
                          <td className="py-3 px-4 text-right num-font font-bold">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${
                              item.projected_margin_pct > 50
                                ? 'bg-[#10B981]/20 text-[#10B981]'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {item.projected_margin_pct?.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overhead Bills Pool Table */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-[#38BDF8]" />
                    Attached Overhead Expense Invoices
                  </h4>
                  <span className="text-xs text-slate-400">
                    Allocated across {shipmentDetails.items.length} items
                  </span>
                </div>

                <div className="divide-y divide-white/5 text-xs">
                  {shipmentDetails.overheads.map((ovh) => (
                    <div key={ovh.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{ovh.vendorName}</span>
                        <span className="text-slate-400 ml-2">({ovh.category.replace(/_/g, ' ')})</span>
                        {ovh.invoiceNumber && (
                          <span className="text-[10px] font-mono text-slate-500 ml-2">#{ovh.invoiceNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300 border border-white/5">
                          Method: {ovh.allocationBasis}
                        </span>
                        <span className="font-bold num-font text-white">{formatMoney(ovh.amountBase || ovh.amountForeign)}</span>
                        {shipmentDetails.shipment.status !== 'FINALIZED' && (
                          <div className="flex items-center gap-1.5 ml-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOverhead(ovh)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-[#E5A93C]/20 text-slate-400 hover:text-[#E5A93C] border border-white/5 transition"
                              title="Edit overhead fee or allocation rule"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOverhead(ovh.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition"
                              title="Remove overhead invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accountant Mode: Journal Preview */}
              {mode === 'ACCOUNTANT' && (
                <div className="glass-card p-4 border border-[#38BDF8]/20 bg-[#38BDF8]/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">
                      Automated Posting Rule (Accounting Invariant)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">Source: Landed Cost Engine</span>
                  </div>
                  <div className="text-xs font-mono space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>Debit 1200 Inventory Asset (True Landed Cost)</span>
                      <span className="text-[#10B981] font-bold">Dr {formatMoney(shipmentDetails.summary.totalLandedCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="pl-4">Credit 2020 Goods Received Not Invoiced (Factory Bill)</span>
                      <span className="text-rose-400 font-bold">Cr {formatMoney(shipmentDetails.summary.totalGoodsCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="pl-4">Credit 1215 Landed Cost Clearing (Freight, Duties, Port)</span>
                      <span className="text-rose-400 font-bold">Cr {formatMoney(shipmentDetails.summary.totalOverheadCost)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-12 text-center text-slate-400">
              Select an import shipment on the left or create a new batch.
            </div>
          )}
        </div>

      </div>
      ) : (
        <ImportHistoryView isEmbedded={true} />
      )}

      {/* MODAL: ADD OVERHEAD FEE */}
      {isOverheadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Add Import Overhead Bill</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a freight, duty, or clearance invoice to distribute into unit costs.
            </p>

            <form onSubmit={handleAddOverhead} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Overhead Category</label>
                <select
                  value={overheadForm.category}
                  onChange={(e) => setOverheadForm({ ...overheadForm, category: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="INTERNATIONAL_FREIGHT">International Freight (Sea / Air)</option>
                  <option value="CUSTOMS_DUTY">Customs Tariff & Import Duties</option>
                  <option value="PORT_CLEARANCE_THC">Port Clearing, Demurrage & THC</option>
                  <option value="BROKERAGE_INSPECTION">Customs Brokerage & Inspection</option>
                  <option value="LOCAL_TRUCKING">Inland Trucking & Drayage</option>
                  <option value="CARGO_INSURANCE">Cargo Marine Insurance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Vendor / Forwarder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DHL Global Forwarding, Apex Brokerage"
                  value={overheadForm.vendorName}
                  onChange={(e) => setOverheadForm({ ...overheadForm, vendorName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1500.00"
                    value={overheadForm.amount}
                    onChange={(e) => setOverheadForm({ ...overheadForm, amount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Allocation Rule</label>
                  <select
                    value={overheadForm.allocationBasis}
                    onChange={(e) => setOverheadForm({ ...overheadForm, allocationBasis: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="BY_WEIGHT">By Weight (kg) - Ideal for Freight</option>
                    <option value="BY_VALUE">By Value - Ideal for Duties/Insurance</option>
                    <option value="BY_VOLUME">By Volume (CBM) - Sea Containers</option>
                    <option value="BY_QUANTITY">By Quantity - Flat Handling</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOverheadModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Distribute Overhead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT OVERHEAD FEE */}
      {isEditOverheadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Edit Import Overhead Bill</h3>
            <p className="text-xs text-slate-400 mb-4">
              Update freight or duty amount and allocation rule. Unit landed costs will recalculate automatically.
            </p>

            <form onSubmit={handleSaveEditOverhead} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Overhead Category</label>
                <select
                  value={editOverheadForm.category}
                  onChange={(e) => setEditOverheadForm({ ...editOverheadForm, category: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="INTERNATIONAL_FREIGHT">International Freight (Sea / Air)</option>
                  <option value="CUSTOMS_DUTY">Customs Tariff & Import Duties</option>
                  <option value="PORT_CLEARANCE_THC">Port Clearing, Demurrage & THC</option>
                  <option value="BROKERAGE_INSPECTION">Customs Brokerage & Inspection</option>
                  <option value="LOCAL_TRUCKING">Inland Trucking & Drayage</option>
                  <option value="CARGO_INSURANCE">Cargo Marine Insurance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Vendor / Forwarder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DHL Global Forwarding, Apex Brokerage"
                  value={editOverheadForm.vendorName}
                  onChange={(e) => setEditOverheadForm({ ...editOverheadForm, vendorName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Invoice / Reference # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-99"
                  value={editOverheadForm.invoiceNumber}
                  onChange={(e) => setEditOverheadForm({ ...editOverheadForm, invoiceNumber: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 800.00"
                    value={editOverheadForm.amount}
                    onChange={(e) => setEditOverheadForm({ ...editOverheadForm, amount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Allocation Rule</label>
                  <select
                    value={editOverheadForm.allocationBasis}
                    onChange={(e) => setEditOverheadForm({ ...editOverheadForm, allocationBasis: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="BY_WEIGHT">By Weight (kg) - Ideal for Freight</option>
                    <option value="BY_VALUE">By Value - Ideal for Duties/Insurance</option>
                    <option value="BY_VOLUME">By Volume (CBM) - Sea Containers</option>
                    <option value="BY_QUANTITY">By Quantity - Flat Handling</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditOverheadModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Save & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW IMPORT SHIPMENT */}
      {isNewShipmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-3xl p-6 sm:p-7 border border-white/20 animate-in fade-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Ship className="w-5 h-5 text-[#E5A93C]" />
                  Create New Import Shipment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter incoming batch details from overseas factory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewShipmentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-semibold text-xs">Shipment Code</label>
                    <button
                      type="button"
                      onClick={() => setNewShipmentForm(prev => ({ ...prev, shipmentCode: generateShipmentCode() }))}
                      className="text-[11px] text-[#E5A93C] hover:underline flex items-center gap-1 font-mono"
                      title="Generate new unique code"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="IMP-2026-XXXX"
                    value={newShipmentForm.shipmentCode}
                    onChange={(e) => setNewShipmentForm({ ...newShipmentForm, shipmentCode: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Supplier / Factory</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hong Kong Precision Studio"
                    value={newShipmentForm.supplierName}
                    onChange={(e) => setNewShipmentForm({ ...newShipmentForm, supplierName: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Origin Country</label>
                  <input
                    type="text"
                    value={newShipmentForm.originCountry}
                    onChange={(e) => setNewShipmentForm({ ...newShipmentForm, originCountry: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Shipping Terms</label>
                  <select
                    value={newShipmentForm.shippingTerms}
                    onChange={(e) => setNewShipmentForm({ ...newShipmentForm, shippingTerms: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="FOB">FOB (Free On Board)</option>
                    <option value="EXW">EXW (Ex Works)</option>
                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    <option value="DDP">DDP (Delivered Duty Paid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">
                    Shipping Category <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={newShipmentForm.shippingCategory}
                    onChange={(e) => setNewShipmentForm({ ...newShipmentForm, shippingCategory: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="">None / Not Specified (Optional)</option>
                    {shippingCategories.length > 0 ? (
                      shippingCategories.map(sc => (
                        <option key={sc.id} value={sc.name}>{sc.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Air Shipping">Air Shipping (Air Cargo)</option>
                        <option value="Sea Shipping">Sea Shipping (Ocean Freight)</option>
                        <option value="Land Shipping">Land Shipping (Cross-Border Truck)</option>
                        <option value="Express Shipping">Express Shipping (Express Courier)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E5A93C]" />
                    Products in Shipment / Purchase Order
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-slate-300 font-normal">
                      {newShipmentForm.items.length} {newShipmentForm.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewShipmentForm(prev => ({
                        ...prev,
                        items: [
                          ...prev.items,
                          createBlankItem(prev.items.length + 1)
                        ]
                      }));
                    }}
                    className="text-xs text-[#E5A93C] hover:text-[#F3C368] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Product
                  </button>
                </div>

                {newShipmentForm.items.map((it, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3.5 text-xs shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#E5A93C]/15 text-[#E5A93C] font-mono font-bold text-xs">
                          Product #{idx + 1}
                        </span>
                        {it.productName && (
                          <span className="text-slate-300 font-medium truncate max-w-[280px]">
                            {it.productName}
                          </span>
                        )}
                      </div>
                      {newShipmentForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewShipmentForm(prev => ({
                              ...prev,
                              items: prev.items.filter((_, i) => i !== idx)
                            }));
                          }}
                          className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Product
                        </button>
                      )}
                    </div>

                    {/* Row 1: Product Name & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-slate-300 font-medium block mb-1">Product Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Linen Blend Shirt"
                          value={it.productName}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].productName = e.target.value;
                            if (!newItems[idx].skuCode || newItems[idx].skuCode.startsWith('BV-GEN-')) {
                              newItems[idx].skuCode = generateAutoSku(newItems[idx].category, e.target.value);
                            }
                            if (!newItems[idx].barcode) {
                              newItems[idx].barcode = generateAutoBarcode();
                            }
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1 flex items-center justify-between">
                          <span>Category</span>
                          <span className="text-[10px] text-[#E5A93C] font-mono">Auto-sync</span>
                        </label>
                        <input
                          type="text"
                          list="finance-cat-options"
                          placeholder="Select or enter..."
                          value={it.category || ''}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].category = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                    </div>

                    {/* Row 2: SKU Code & Barcode (Printable) - Single Barcode Field */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-300 font-medium">SKU Code</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...newShipmentForm.items];
                              newItems[idx].skuCode = generateAutoSku(newItems[idx].category, newItems[idx].productName);
                              setNewShipmentForm({ ...newShipmentForm, items: newItems });
                            }}
                            className="text-[10px] text-[#E5A93C] hover:underline flex items-center gap-1 font-mono"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> Auto-Gen
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. BV-LBN-1020"
                          value={it.skuCode}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].skuCode = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-[#E5A93C] focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-300 font-medium">Barcode (Printable)</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...newShipmentForm.items];
                              newItems[idx].barcode = generateAutoBarcode();
                              setNewShipmentForm({ ...newShipmentForm, items: newItems });
                            }}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> Auto-Gen
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 880123456789"
                          value={it.barcode}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].barcode = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* Row 3: Quantity, Buy Cost, Selling Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Quantity (Units)</label>
                        <input
                          type="number"
                          placeholder="e.g. 100"
                          value={it.quantity}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].quantity = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Buy Cost ($ / unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 12.50"
                          value={it.unitBasePrice}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].unitBasePrice = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Selling Price ($ / unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 29.00"
                          value={it.targetRetailPrice}
                          onChange={(e) => {
                            const newItems = [...newShipmentForm.items];
                            newItems[idx].targetRetailPrice = e.target.value;
                            setNewShipmentForm({ ...newShipmentForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-[#10B981] focus:outline-none focus:border-[#10B981]"
                        />
                      </div>
                    </div>

                    {/* Row 4: Dedicated Product Picture / Photo Uploader */}
                    <div className="pt-2 border-t border-white/5">
                      <ItemImagePicker
                        imageUrl={it.imageUrl || ''}
                        onImageChange={(url) => {
                          const newItems = [...newShipmentForm.items];
                          newItems[idx].imageUrl = url;
                          setNewShipmentForm({ ...newShipmentForm, items: newItems });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewShipmentModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368] shadow-md shadow-[#E5A93C]/20 transition"
                >
                  Create Shipment & Compute Cost
                </button>
              </div>

              <datalist id="finance-cat-options">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT IMPORT SHIPMENT */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-3xl p-6 sm:p-7 border border-white/20 animate-in fade-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#E5A93C]" />
                  Edit Import Shipment & Items
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update shipment details, product categories, quantities, or costs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Shipment Code</label>
                  <input
                    type="text"
                    required
                    value={editForm.shipmentCode}
                    onChange={(e) => setEditForm({ ...editForm, shipmentCode: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Supplier / Factory</label>
                  <input
                    type="text"
                    required
                    value={editForm.supplierName}
                    onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Origin Country</label>
                  <input
                    type="text"
                    value={editForm.originCountry}
                    onChange={(e) => setEditForm({ ...editForm, originCountry: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Shipping Terms</label>
                  <select
                    value={editForm.shippingTerms}
                    onChange={(e) => setEditForm({ ...editForm, shippingTerms: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="FOB">FOB (Free on Board)</option>
                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    <option value="EXW">EXW (Ex Works)</option>
                    <option value="DDP">DDP (Delivered Duty Paid)</option>
                    <option value="CFR">CFR (Cost & Freight)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">
                    Shipping Category <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={editForm.shippingCategory}
                    onChange={(e) => setEditForm({ ...editForm, shippingCategory: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="">None / Not Specified (Optional)</option>
                    {shippingCategories.length > 0 ? (
                      shippingCategories.map(sc => (
                        <option key={sc.id} value={sc.name}>{sc.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Air Shipping">Air Shipping (Air Cargo)</option>
                        <option value="Sea Shipping">Sea Shipping (Ocean Freight)</option>
                        <option value="Land Shipping">Land Shipping (Cross-Border Truck)</option>
                        <option value="Express Shipping">Express Shipping (Express Courier)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Exchange Rate (USD)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editForm.exchangeRate}
                    onChange={(e) => setEditForm({ ...editForm, exchangeRate: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1.5">Notes / Tracking</label>
                  <input
                    type="text"
                    placeholder="PO number, container ID, notes..."
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
              </div>

              {/* Items List in Edit */}
              <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E5A93C]" />
                    Shipment Items
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-slate-300 font-normal">
                      {editForm.items.length} {editForm.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm({
                        ...editForm,
                        items: [
                          ...editForm.items,
                          {
                            productName: '',
                            skuCode: `SKU-IMP-${editForm.items.length + 1}`,
                            barcode: generateAutoBarcode(),
                            category: '',
                            quantity: 50,
                            unitBasePrice: 10.0,
                            targetRetailPrice: 25.0,
                            unitWeightKg: 0.3,
                            unitVolumeCbm: 0.001,
                            imageUrl: ''
                          }
                        ]
                      });
                    }}
                    className="text-xs text-[#E5A93C] hover:text-[#F3C368] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Product
                  </button>
                </div>

                {editForm.items.map((it, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3.5 text-xs shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#E5A93C]/15 text-[#E5A93C] font-mono font-bold text-xs">
                          Product #{idx + 1}
                        </span>
                        {it.productName && (
                          <span className="text-slate-300 font-medium truncate max-w-[280px]">
                            {it.productName}
                          </span>
                        )}
                      </div>
                      {editForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = editForm.items.filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Product
                        </button>
                      )}
                    </div>

                    {/* Row 1: Product Name & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-slate-300 font-medium block mb-1">Product Name *</label>
                        <input
                          type="text"
                          required
                          value={it.productName}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].productName = e.target.value;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1 flex items-center justify-between">
                          <span>Category</span>
                          <span className="text-[10px] text-[#E5A93C] font-mono">Stock Sync</span>
                        </label>
                        <input
                          type="text"
                          list="finance-cat-options"
                          placeholder="Select or enter..."
                          value={it.category || ''}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].category = e.target.value;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                    </div>

                    {/* Row 2: SKU Code & Barcode (Printable) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">SKU Code</label>
                        <input
                          type="text"
                          required
                          value={it.skuCode}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].skuCode = e.target.value;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-[#E5A93C] focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-300 font-medium">Barcode (Printable)</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = [...editForm.items];
                              newItems[idx].barcode = generateAutoBarcode();
                              setEditForm({ ...editForm, items: newItems });
                            }}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> Auto-Gen
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 880123456789"
                          value={it.barcode || ''}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].barcode = e.target.value;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    {/* Row 3: Quantity, Buy Cost, Selling Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Quantity (Units)</label>
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].quantity = Number(e.target.value);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Buy Cost ($ / unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.unitBasePrice}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].unitBasePrice = Number(e.target.value);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Selling Price ($ / unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.targetRetailPrice}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx].targetRetailPrice = Number(e.target.value);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-[#111520] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs text-[#10B981] focus:outline-none focus:border-[#10B981]"
                        />
                      </div>
                    </div>

                    {/* Row 4: Dedicated Product Picture / Photo Uploader */}
                    <div className="pt-2 border-t border-white/5">
                      <ItemImagePicker
                        imageUrl={it.imageUrl || ''}
                        onImageChange={(url) => {
                          const newItems = [...editForm.items];
                          newItems[idx].imageUrl = url;
                          setEditForm({ ...editForm, items: newItems });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368] shadow-md shadow-[#E5A93C]/20 transition"
                >
                  Save Changes & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL REUSABLE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        subtitle={confirmConfig.subtitle}
        details={confirmConfig.details}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        isLoading={confirmConfig.isLoading}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ isOpen: false, details: [] })}
      />

    </div>
  );
}

