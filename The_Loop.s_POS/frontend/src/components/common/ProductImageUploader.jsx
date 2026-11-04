import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, RefreshCw, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function ProductImageUploader({
  value = '',
  onChange,
  className = ''
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const fileInputRef = useRef(null);

  const validateAndUpload = async (file) => {
    setErrorMsg('');
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setErrorMsg(`Invalid file type (.${ext}). Allowed: JPG, PNG, WEBP.`);
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 5MB.`);
      return;
    }

    setUploading(true);
    try {
      // Read as base64 to upload to backend /api/upload
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result;
          const token = typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null;
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              image: base64,
              filename: file.name
            })
          });

          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Failed to upload image to server');
          }

          onChange(data.url);
          setUrlInput('');
          setShowUrlField(false);
        } catch (err) {
          setErrorMsg(err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg('Error reading file: ' + err.message);
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndUpload(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const handleApplyUrl = (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
    setShowUrlField(false);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Preview Card or Drag-and-Drop Zone */}
      {value ? (
        <div className="relative group w-full h-44 rounded-xl overflow-hidden border border-obsidian-750 bg-obsidian-950 flex items-center justify-center">
          <img
            src={value}
            alt="Product Preview"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />

          <div className="absolute inset-0 bg-obsidian-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs flex items-center space-x-1 shadow-md shadow-brass-500/20"
              title="Replace picture from computer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>

            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs flex items-center space-x-1"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-obsidian-900/90 border border-obsidian-750 text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Image Attached</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-40 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 cursor-pointer text-center select-none ${
            isDragging
              ? 'border-brass-400 bg-brass-500/10 scale-[1.01]'
              : 'border-obsidian-750 hover:border-brass-500/50 bg-obsidian-900/50 hover:bg-obsidian-900'
          }`}
        >
          {uploading ? (
            <div className="space-y-2 flex flex-col items-center">
              <RefreshCw className="w-6 h-6 text-brass-400 animate-spin" />
              <span className="text-xs font-mono text-slate-300">Uploading to server...</span>
            </div>
          ) : (
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-brass-500/10 border border-brass-500/20 text-brass-400 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                Drag & drop product picture here, or <span className="text-brass-400 underline">browse</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Supports JPG, PNG, WEBP (Max 5MB)
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Fallback Bar */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        <button
          type="button"
          onClick={() => setShowUrlField(!showUrlField)}
          className="text-[11px] text-slate-400 hover:text-brass-400 flex items-center space-x-1 underline font-mono"
        >
          <LinkIcon className="w-3 h-3" />
          <span>{showUrlField ? 'Hide web URL input' : 'Or paste image URL (https://...)'}</span>
        </button>

        {value && (
          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]" title={value}>
            {value.split('/').pop()}
          </span>
        )}
      </div>

      {showUrlField && (
        <form onSubmit={handleApplyUrl} className="flex gap-2 animate-in fade-in">
          <input
            type="url"
            placeholder="https://example.com/images/product.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 bg-obsidian-950 border border-obsidian-750 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-brass-400"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-obsidian-800 hover:bg-brass-500 hover:text-obsidian-950 text-slate-200 rounded-lg text-xs font-bold border border-obsidian-700 transition"
          >
            Apply
          </button>
        </form>
      )}

      {errorMsg && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

