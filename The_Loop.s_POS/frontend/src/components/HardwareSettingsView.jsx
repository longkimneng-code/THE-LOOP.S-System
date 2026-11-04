import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Printer, 
  Scan, 
  DollarSign, 
  Monitor, 
  CheckCircle, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  Sparkles, 
  Terminal,
  Volume2,
  VolumeX,
  Play
} from 'lucide-react';

export default function HardwareSettingsView() {
  const { 
    hardwareConfig, 
    fetchHardwareConfig, 
    updateHardwareConfig,
    playBeep
  } = usePos();

  const [loading, setLoading] = useState(false);
  const [testPrintLoading, setTestPrintLoading] = useState(false);
  const [testSlipOutput, setTestSlipOutput] = useState('');
  const [testBarcodeText, setTestBarcodeText] = useState('');
  const [scannedProductResult, setScannedProductResult] = useState(null);
  const [drawerKickStatus, setDrawerKickStatus] = useState('');

  // Local state for configuration
  const [printerPaper, setPrinterPaper] = useState('80mm');
  const [autoPrint, setAutoPrint] = useState(true);
  const [copies, setCopies] = useState(1);
  const [beepOnScan, setBeepOnScan] = useState(true);
  const [kickOnCash, setKickOnCash] = useState(true);

  useEffect(() => {
    if (hardwareConfig?.printer) {
      setPrinterPaper(hardwareConfig.printer.paperWidth || '80mm');
      setAutoPrint(hardwareConfig.printer.autoPrint !== false);
      setCopies(hardwareConfig.printer.copies || 1);
    }
    if (hardwareConfig?.scanner) {
      setBeepOnScan(hardwareConfig.scanner.beepOnScan !== false);
    }
    if (hardwareConfig?.cashDrawer) {
      setKickOnCash(hardwareConfig.cashDrawer.kickOnCash !== false);
    }
  }, [hardwareConfig]);

  const handleSaveHardware = async () => {
    setLoading(true);
    await updateHardwareConfig({
      printer: {
        ...(hardwareConfig?.printer || {}),
        paperWidth: printerPaper,
        autoPrint,
        copies: Number(copies)
      },
      scanner: {
        ...(hardwareConfig?.scanner || {}),
        beepOnScan
      },
      cashDrawer: {
        ...(hardwareConfig?.cashDrawer || {}),
        kickOnCash
      }
    });
    setLoading(false);
  };

  const handleTestPrint = async () => {
    setTestPrintLoading(true);
    setTestSlipOutput('');
    playBeep(1200, 'sine', 0.1);
    try {
      const res = await fetch('/api/devices/printer/test', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestSlipOutput(data.testSlip || 'Test print signal sent successfully!');
      }
    } catch (err) {
      setTestSlipOutput('Failed to reach printer device.');
    } finally {
      setTestPrintLoading(false);
    }
  };

  const handleTestDrawerKick = async () => {
    playBeep(440, 'square', 0.15);
    try {
      const res = await fetch('/api/devices/drawer/test', { method: 'POST' });
      if (res.ok) {
        setDrawerKickStatus('Cash drawer kick impulse sent (ESC/POS 1B 70 00 19 FA)');
        setTimeout(() => setDrawerKickStatus(''), 3000);
      }
    } catch (e) {
      setDrawerKickStatus('Could not send drawer pulse.');
    }
  };

  const handleBarcodeTest = async (e) => {
    e.preventDefault();
    const q = testBarcodeText.trim();
    if (!q) return;

    if (beepOnScan) playBeep(1400, 'sine', 0.08);

    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        const prods = data.products || [];
        const found = prods.find(p => 
          p.code === q || 
          p.barcode === q || 
          (p.variants && p.variants.some(v => v.sku === q || v.barcode === q))
        );
        if (found) {
          const v = found.variants?.find(vr => vr.sku === q || vr.barcode === q) || found.variants?.[0] || {};
          setScannedProductResult({
            name: found.name,
            sku: v.sku || found.code,
            price: v.price || found.basePrice,
            image: found.imageUrl,
            status: 'FOUND'
          });
        } else {
          setScannedProductResult({
            name: 'No product matches barcode: ' + q,
            status: 'NOT_FOUND'
          });
        }
      }
    } catch (err) {
      setScannedProductResult({ name: 'Error querying catalog', status: 'NOT_FOUND' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-obsidian-950 p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="text-xs font-mono text-brass-400 uppercase tracking-widest">
            Peripherals & Point of Sale Hardware
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Device Connections & Hardware Manager</span>
          </h2>
        </div>

        <button
          onClick={handleSaveHardware}
          disabled={loading}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brass-500 hover:bg-brass-400 text-obsidian-950 shadow-md shadow-brass-500/20 transition active:scale-95 disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          <span>{loading ? 'Saving...' : 'Save Hardware Config'}</span>
        </button>
      </div>

      {/* Hardware Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1. Thermal Receipt Printer */}
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-brass-400" />
                <h3 className="text-sm font-semibold text-slate-100">Thermal Receipt Printer</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                READY
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1 font-mono">
              <div>Device: <span className="text-slate-200">Epson TM-T88VI Thermal</span></div>
              <div>Interface: <span className="text-slate-200">USB / ESC-POS / WebUSB</span></div>
            </div>

            <div className="space-y-3 pt-2 border-t border-obsidian-800/80 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Paper Roll Width</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrinterPaper('80mm')}
                    className={`p-2 rounded-lg border text-center font-mono font-semibold transition ${
                      printerPaper === '80mm'
                        ? 'bg-brass-500/15 border-brass-500 text-brass-400'
                        : 'bg-obsidian-950 border-obsidian-750 text-slate-400'
                    }`}
                  >
                    80mm Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinterPaper('58mm')}
                    className={`p-2 rounded-lg border text-center font-mono font-semibold transition ${
                      printerPaper === '58mm'
                        ? 'bg-brass-500/15 border-brass-500 text-brass-400'
                        : 'bg-obsidian-950 border-obsidian-750 text-slate-400'
                    }`}
                  >
                    58mm Compact
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Auto-Print on Checkout</span>
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Receipt Copies</span>
                <select
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  className="bg-obsidian-950 border border-obsidian-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-mono"
                >
                  <option value={1}>1 Copy (Customer)</option>
                  <option value={2}>2 Copies (Customer + Merchant)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-obsidian-800">
            <button
              onClick={handleTestPrint}
              disabled={testPrintLoading}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-obsidian-700 transition"
            >
              <Printer className="w-3.5 h-3.5 text-brass-400" />
              <span>{testPrintLoading ? 'Dispatching...' : 'Test Print Diagnostic Slip'}</span>
            </button>
          </div>
        </div>

        {/* 2. Barcode Scanner */}
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scan className="w-5 h-5 text-brass-400" />
                <h3 className="text-sm font-semibold text-slate-100">Barcode / QR Scanner</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1 font-mono">
              <div>Mode: <span className="text-slate-200">USB HID Keyboard Emulation</span></div>
              <div>Listener: <span className="text-emerald-400">Continuous Window Intercept</span></div>
            </div>

            <div className="space-y-3 pt-2 border-t border-obsidian-800/80 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  {beepOnScan ? <Volume2 className="w-4 h-4 text-brass-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <span>Audio Beep on Scan</span>
                </div>
                <input
                  type="checkbox"
                  checked={beepOnScan}
                  onChange={(e) => setBeepOnScan(e.target.checked)}
                  className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Barcode Tester */}
              <div>
                <label className="text-slate-400 block mb-1">Scanner Test Bench</label>
                <form onSubmit={handleBarcodeTest} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Scan or type barcode/SKU..."
                    value={testBarcodeText}
                    onChange={(e) => setTestBarcodeText(e.target.value)}
                    className="flex-1 bg-obsidian-950 border border-obsidian-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brass-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-obsidian-800 hover:bg-obsidian-750 text-brass-400 border border-obsidian-700"
                  >
                    Test
                  </button>
                </form>
              </div>

              {scannedProductResult && (
                <div className={`p-2 rounded-lg text-xs font-mono border ${
                  scannedProductResult.status === 'FOUND'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  <div className="font-bold">{scannedProductResult.name}</div>
                  {scannedProductResult.sku && (
                    <div className="text-[10px] text-slate-400">
                      SKU: {scannedProductResult.sku} • Price: ${Number(scannedProductResult.price).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-obsidian-800 text-[11px] text-slate-500">
            Scanning on any screen automatically adds item to active cart.
          </div>
        </div>

        {/* 3. Cash Drawer & Customer Display */}
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-brass-400" />
                <h3 className="text-sm font-semibold text-slate-100">Electronic Cash Drawer</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                CONNECTED
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1 font-mono">
              <div>Port: <span className="text-slate-200">RJ12 Printer Pass-through</span></div>
              <div>Pulse: <span className="text-slate-200">200ms Solenoid Kick</span></div>
            </div>

            <div className="space-y-3 pt-2 border-t border-obsidian-800/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Kick on Cash Checkout</span>
                <input
                  type="checkbox"
                  checked={kickOnCash}
                  onChange={(e) => setKickOnCash(e.target.checked)}
                  className="rounded bg-obsidian-950 border-obsidian-700 text-brass-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {drawerKickStatus && (
                <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono text-center">
                  {drawerKickStatus}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-obsidian-800">
            <button
              onClick={handleTestDrawerKick}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-obsidian-700 transition"
            >
              <Play className="w-3.5 h-3.5 text-brass-400" />
              <span>Test Kick Cash Drawer</span>
            </button>
          </div>
        </div>

      </div>

      {/* Thermal Print Slip Preview */}
      {testSlipOutput && (
        <div className="bg-obsidian-900 border border-obsidian-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 font-mono">
              Receipt Printer Output Simulation
            </span>
            <button
              onClick={() => setTestSlipOutput('')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800 text-brass-400 font-mono text-xs overflow-x-auto whitespace-pre">
            {testSlipOutput}
          </pre>
        </div>
      )}
    </div>
  );
}

