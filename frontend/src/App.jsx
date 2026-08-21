import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Scan,
  Layers,
  Sliders,
  RefreshCw,
  Eye,
  EyeOff,
  Crosshair,
  Download,
  AlertCircle,
  Sun,
  Moon,
  Zap,
  ShieldCheck,
  Cpu,
  History,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Target,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  Check,
  Copy,
  X
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('mdf_theme') || 'dark';
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [threshold, setThreshold] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filterClass, setFilterClass] = useState('ALL');
  
  // Export Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('yolo'); // 'yolo' | 'coco' | 'csv'
  const [copied, setCopied] = useState(false);

  // Floating Left History State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const saved = localStorage.getItem('visiontracker_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mdf_theme', theme);
  }, [theme]);

  // Sync compact history to localStorage
  useEffect(() => {
    try {
      const compactHistory = historyItems.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        fileName: item.fileName,
        summary: item.summary,
        latency: item.latency,
        labels: item.labels
      }));
      localStorage.setItem('visiontracker_history', JSON.stringify(compactHistory));
    } catch (e) {
      console.warn('Storage warning:', e);
    }
  }, [historyItems]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const sampleImages = [
    {
      name: 'Street Traffic',
      url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Golden Retriever',
      url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Espresso Coffee',
      url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'
    }
  ];

  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPEG, WebP).');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setResult(null);
    setSelectedDetection(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const loadSampleImage = async (url, name) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${name.toLowerCase().replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' });
      handleFileSelect(file);
    } catch (err) {
      setError(`Failed to load sample image: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = (data, origPreview, fileName) => {
    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      fileName: fileName || 'Uploaded Image',
      previewUrl: origPreview,
      result: data,
      threshold: threshold,
      summary: `${data.detected_count} objects detected`,
      latency: data.inference_time_ms,
      labels: Array.from(new Set(data.detections.map(d => d.label)))
    };
    setHistoryItems(prev => [newItem, ...prev.slice(0, 15)]);
  };

  const loadHistoryItem = (item) => {
    if (item.previewUrl) setPreviewUrl(item.previewUrl);
    if (item.result) setResult(item.result);
    if (item.threshold) setThreshold(item.threshold);
    setSelectedDetection(null);
    setFilterClass('ALL');
    setError(null);
  };

  const deleteHistoryItem = (e, id) => {
    e.stopPropagation();
    setHistoryItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    if (confirm('Clear all detection history?')) {
      setHistoryItems([]);
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setSelectedDetection(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const endpoint = `/api/detect?threshold=${threshold}&render_boxes=true`;
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });
      } catch (networkErr) {
        response = await fetch(`http://localhost:8080${endpoint}`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Detection failed' }));
        throw new Error(errorData.detail || `Server error ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      setFilterClass('ALL');
      saveToHistory(data, previewUrl, selectedFile.name);
    } catch (err) {
      setError(err.message || 'An error occurred while connecting to the backend.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDetections = result
    ? result.detections.filter(d => filterClass === 'ALL' || d.label === filterClass)
    : [];

  const uniqueLabels = result
    ? Array.from(new Set(result.detections.map(d => d.label)))
    : [];

  const downloadImage = (imgBase64, filename) => {
    if (!imgBase64) return;
    const link = document.createElement('a');
    link.href = imgBase64;
    link.download = filename;
    link.click();
  };

  // Generate YOLO Format Text (.txt)
  // Format: <class_index> <x_center_rel> <y_center_rel> <width_rel> <height_rel>
  const generateYOLO = () => {
    if (!result || !result.detections) return '';
    const lines = result.detections.map(d => {
      const x_center = (d.box.rel_xmin + d.box.rel_xmax) / 2;
      const y_center = (d.box.rel_ymin + d.box.rel_ymax) / 2;
      const width = d.box.rel_xmax - d.box.rel_xmin;
      const height = d.box.rel_ymax - d.box.rel_ymin;
      return `${d.label} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)} (confidence: ${d.confidence.toFixed(2)})`;
    });
    return lines.join('\n');
  };

  // Generate Standard COCO JSON (.json)
  const generateCOCO = () => {
    if (!result) return '{}';
    const categories = Array.from(new Set(result.detections.map(d => d.label))).map((lbl, idx) => ({
      id: idx + 1,
      name: lbl,
      supercategory: 'object'
    }));

    const categoryMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

    const annotations = result.detections.map((d, idx) => ({
      id: idx + 1,
      image_id: 1,
      category_id: categoryMap[d.label] || 1,
      bbox: [d.box.xmin, d.box.ymin, d.box.width, d.box.height],
      area: Number((d.box.width * d.box.height).toFixed(2)),
      score: d.confidence,
      iscrowd: 0
    }));

    const cocoData = {
      info: {
        description: 'VisionTracker DETR Object Annotations',
        version: '1.0',
        year: new Date().getFullYear(),
        date_created: new Date().toISOString()
      },
      images: [
        {
          id: 1,
          file_name: selectedFile?.name || 'image.jpg',
          width: result.image_width,
          height: result.image_height
        }
      ],
      annotations: annotations,
      categories: categories
    };

    return JSON.stringify(cocoData, null, 2);
  };

  // Generate CSV Format (.csv)
  const generateCSV = () => {
    if (!result || !result.detections) return '';
    const header = 'detection_id,label,confidence,xmin,ymin,xmax,ymax,width,height,rel_xmin,rel_ymin,rel_xmax,rel_ymax\n';
    const rows = result.detections.map((d, idx) => {
      return `${idx + 1},"${d.label}",${d.confidence},${d.box.xmin},${d.box.ymin},${d.box.xmax},${d.box.ymax},${d.box.width},${d.box.height},${d.box.rel_xmin},${d.box.rel_ymin},${d.box.rel_xmax},${d.box.rel_ymax}`;
    }).join('\n');
    return header + rows;
  };

  const getExportContent = () => {
    if (exportFormat === 'yolo') return generateYOLO();
    if (exportFormat === 'coco') return generateCOCO();
    if (exportFormat === 'csv') return generateCSV();
    return '';
  };

  const downloadAnnotationFile = () => {
    const content = getExportContent();
    const baseName = (selectedFile?.name || 'detections').replace(/\.[^/.]+$/, '');
    let ext = 'txt';
    let mimeType = 'text/plain';

    if (exportFormat === 'coco') {
      ext = 'json';
      mimeType = 'application/json';
    } else if (exportFormat === 'csv') {
      ext = 'csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_annotations.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getExportContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-[var(--accent)] selection:text-[var(--accent-ink)] relative overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl border-b border-[var(--border)] bg-[var(--bg)]/80">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Left History Toggle Button */}
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 font-mono text-xs shrink-0 ${
                historyOpen
                  ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)] font-bold shadow-[var(--glow)]'
                  : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border-strong)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]'
              }`}
              title="Toggle floating history sidebar"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">History</span>
              {historyItems.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  historyOpen ? 'bg-[var(--accent-ink)] text-[var(--accent)]' : 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-line)]'
                }`}>
                  {historyItems.length}
                </span>
              )}
            </button>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Scan className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[var(--ink)] flex items-center gap-1.5 font-['Space_Grotesk'] truncate">
                <span>VisionTracker</span>
                <span className="hidden sm:inline-block text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent)] font-semibold">
                  DETR Vision
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-8 h-8 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent-line)] flex items-center justify-center text-[var(--ink)] transition-all cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Floating Left Opener (when closed) */}
      {!historyOpen && (
        <button
          onClick={() => setHistoryOpen(true)}
          className="fixed left-4 top-20 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--surface)]/95 border border-[var(--border-strong)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)] text-[var(--ink)] shadow-[var(--shadow-soft)] backdrop-blur-md transition-all group cursor-pointer"
          title="Open history panel"
        >
          <History className="w-4 h-4 text-[var(--accent)] group-hover:rotate-12 transition-transform" />
          <span className="font-mono text-xs font-semibold">History</span>
          {historyItems.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block animate-pulse" />
          )}
        </button>
      )}

      {/* Main Container */}
      <main className="max-w-[1160px] mx-auto px-6 py-8 w-full flex-1 flex flex-col gap-8">
        {/* Header Hero Title */}
        <div className="text-left">
          <span className="font-mono font-semibold text-xs tracking-[0.16em] uppercase text-[var(--accent)] block mb-2">
            Hugging Face Vision Transformers
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
            Object detection with <span className="text-[var(--accent)]">DETR Transformers.</span>
          </h1>
          <p className="text-[var(--muted)] text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Evaluate object queries and attention maps. Get predicted bounding coordinates, tags, and confidence metadata with Hugging Face End-to-End Object Detection.
          </p>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Confidence Controls */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Upload Box */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[var(--faint)] flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Image Source
                </span>
                {selectedFile && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setResult(null);
                      setError(null);
                    }}
                    className="font-mono text-xs text-[var(--faint)] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    [Clear]
                  </button>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-[var(--radius-sm)] p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2.5 min-h-[140px] ${
                  isDragOver
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] scale-[0.99]'
                    : 'border-[var(--border-strong)] bg-[var(--surface-2)] hover:border-[var(--accent-line)]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <div className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    Choose an image or drop here
                  </p>
                  <p className="font-mono text-xs text-[var(--faint)] mt-0.5">
                    PNG, JPG, WEBP
                  </p>
                </div>
              </div>

              {/* Sample Presets */}
              <div>
                <p className="font-mono text-xs font-medium text-[var(--faint)] mb-2 uppercase tracking-wider">
                  Sample Presets:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {sampleImages.map((s, idx) => (
                    <button
                      key={idx}
                      disabled={loading}
                      onClick={() => loadSampleImage(s.url, s.name)}
                      className="text-center font-mono text-xs bg-[var(--surface-2)] hover:bg-[var(--accent-soft)] border border-[var(--border)] hover:border-[var(--accent-line)] py-2 px-1 rounded-[var(--radius-sm)] transition-all truncate text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50 cursor-pointer"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Cutoff Slider */}
              <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="threshold" className="font-medium text-[var(--ink)] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
                    Confidence Cutoff
                  </label>
                  <span className="font-mono text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded border border-[var(--accent-line)]">
                    {Math.round(threshold * 100)}%
                  </span>
                </div>
                <input
                  id="threshold"
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
                <div className="flex justify-between font-mono text-[10px] text-[var(--faint)]">
                  <span>0.10 (loose)</span>
                  <span>0.95 (strict)</span>
                </div>
              </div>

              {/* Primary Run Button */}
              <button
                onClick={processImage}
                disabled={!selectedFile || loading}
                className={`w-full py-3 px-4 rounded-[var(--radius-sm)] font-bold text-sm flex items-center justify-center gap-2 transition-all select-none cursor-pointer ${
                  !selectedFile || loading
                    ? 'bg-[var(--surface-2)] text-[var(--faint)] border border-[var(--border)] cursor-not-allowed'
                    : 'bg-[var(--accent-fill)] hover:bg-[var(--accent-fill-hover)] text-[var(--accent-ink)] shadow-[var(--glow)] active:translate-y-0.5'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running DETR Transformer...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Run Object Detection
                  </>
                )}
              </button>
            </div>

            {/* Telemetry Stats */}
            {result && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 shadow-[var(--shadow-soft)] flex flex-col gap-3">
                <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[var(--faint)] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Inference Telemetry
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[var(--surface-2)] border border-[var(--border)] p-2.5 rounded-[var(--radius-sm)] flex flex-col justify-center min-w-0">
                    <p className="font-mono text-[10px] text-[var(--faint)] uppercase truncate">Objects</p>
                    <p className="text-sm font-bold font-mono text-[var(--accent)] mt-0.5 truncate">
                      {result.detected_count}
                    </p>
                  </div>

                  <div className="bg-[var(--surface-2)] border border-[var(--border)] p-2.5 rounded-[var(--radius-sm)] flex flex-col justify-center min-w-0">
                    <p className="font-mono text-[10px] text-[var(--faint)] uppercase truncate">Latency</p>
                    <p className="text-sm font-bold font-mono text-[var(--green)] mt-0.5 truncate">
                      {result.inference_time_ms >= 1000
                        ? `${(result.inference_time_ms / 1000).toFixed(2)}s`
                        : `${Math.round(result.inference_time_ms)}ms`}
                    </p>
                  </div>

                  <div className="bg-[var(--surface-2)] border border-[var(--border)] p-2.5 rounded-[var(--radius-sm)] flex flex-col justify-center min-w-0">
                    <p className="font-mono text-[10px] text-[var(--faint)] uppercase truncate">Resolution</p>
                    <p className="text-xs font-bold font-mono text-[var(--ink)] mt-1 truncate">
                      {result.image_width}×{result.image_height}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Visualizer & Results Inspector */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {/* Visualizer Card */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 shadow-[var(--shadow-soft)] flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[var(--faint)] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Visualizer Canvas
                </span>

                {result && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="font-mono text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent-line)] text-[var(--ink)] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {showOriginal ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {showOriginal ? 'AI View' : 'Original Image'}
                    </button>

                    <button
                      onClick={() => setExportModalOpen(true)}
                      className="font-mono text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)] text-[var(--ink)] flex items-center gap-1.5 transition-all font-semibold cursor-pointer"
                      title="Export Annotations to YOLO, COCO, or CSV"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Export Labels (ML)
                    </button>

                    <button
                      onClick={() => downloadImage(result.annotated_image_base64, `detr_${selectedFile?.name || 'export.jpg'}`)}
                      className="font-mono text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--accent-line)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] text-[var(--accent)] flex items-center gap-1.5 transition-all font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Image
                    </button>
                  </div>
                )}
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3.5 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Inference Error</p>
                    <p className="text-[var(--muted)] mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Visualizer Frame with Mac-style header bar */}
              <div className="border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-2)] flex flex-col">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 bg-[var(--surface-2)] font-mono text-[11px] text-[var(--faint)]">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] inline-block opacity-80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] inline-block opacity-80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840] inline-block opacity-80" />
                  </div>
                  <span>detr_bounding_boxes.tensor</span>
                </div>

                <div className="relative min-h-[380px] max-h-[580px] flex items-center justify-center p-3 overflow-hidden">
                  {previewUrl ? (
                    <div className="relative inline-block max-w-full max-h-[540px]">
                      <img
                        src={showOriginal ? previewUrl : (result?.annotated_image_base64 || previewUrl)}
                        alt="Detection visualizer"
                        className="max-h-[520px] w-auto max-w-full object-contain rounded-md shadow-lg block mx-auto select-none"
                      />

                      {/* Interactive Bounding Box Focus Highlight */}
                      {result && !showOriginal && selectedDetection && (
                        <div
                          className="absolute border-2 rounded pointer-events-none transition-all duration-150 animate-pulse"
                          style={{
                            borderColor: selectedDetection.color,
                            boxShadow: `0 0 14px ${selectedDetection.color}90, inset 0 0 10px ${selectedDetection.color}40`,
                            left: `${selectedDetection.box.rel_xmin * 100}%`,
                            top: `${selectedDetection.box.rel_ymin * 100}%`,
                            width: `${(selectedDetection.box.rel_xmax - selectedDetection.box.rel_xmin) * 100}%`,
                            height: `${(selectedDetection.box.rel_ymax - selectedDetection.box.rel_ymin) * 100}%`,
                          }}
                        >
                          <span
                            className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-bold text-white font-mono uppercase tracking-wider"
                            style={{ backgroundColor: selectedDetection.color }}
                          >
                            {selectedDetection.label} ({Math.round(selectedDetection.confidence * 100)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-8 flex flex-col items-center gap-2.5 text-[var(--faint)]">
                      <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] opacity-70">
                        <Crosshair className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-[var(--muted)]">No image loaded</p>
                        <p className="font-mono text-[11px] text-[var(--faint)] mt-1">Upload a photo to run DETR object detection</p>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-[var(--bg)]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                      <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-line)] border-t-[var(--accent)] animate-spin" />
                      <p className="font-mono text-xs text-[var(--accent)] tracking-wider">
                        Running DETR Vision Transformer...
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Class Filter Chips */}
              {result && uniqueLabels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="font-mono text-xs text-[var(--faint)] mr-1">Filter:</span>
                  <button
                    onClick={() => setFilterClass('ALL')}
                    className={`font-mono text-xs px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                      filterClass === 'ALL'
                        ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)] font-bold'
                        : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--accent-line)]'
                    }`}
                  >
                    ALL ({result.detections.length})
                  </button>
                  {uniqueLabels.map((lbl) => {
                    const count = result.detections.filter(d => d.label === lbl).length;
                    return (
                      <button
                        key={lbl}
                        onClick={() => setFilterClass(lbl)}
                        className={`font-mono text-xs px-2.5 py-0.5 rounded-full border capitalize transition-all cursor-pointer ${
                          filterClass === lbl
                            ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)] font-bold'
                            : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--accent-line)]'
                        }`}
                      >
                        {lbl} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DETECTED OBJECTS INSPECTOR */}
            {result && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-5 shadow-[var(--shadow-soft)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-semibold tracking-wider uppercase text-[var(--faint)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Detected Objects & Coordinates
                    </span>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Click any card below to focus its bounding box in the visualizer above
                    </p>
                  </div>
                  {selectedDetection && (
                    <button
                      onClick={() => setSelectedDetection(null)}
                      className="font-mono text-xs text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      [Clear Focus]
                    </button>
                  )}
                </div>

                {filteredDetections.length === 0 ? (
                  <div className="p-4 text-center font-mono text-xs text-[var(--faint)] bg-[var(--surface-2)] rounded-[var(--radius-sm)] border border-[var(--border)]">
                    No detections match current filter or threshold.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {filteredDetections.map((det, index) => {
                      const isSelected = selectedDetection === det;
                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedDetection(isSelected ? null : det)}
                          className={`p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-all flex flex-col gap-2 ${
                            isSelected
                              ? 'bg-[var(--accent-soft)] border-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: det.color }}
                              />
                              <span className="font-bold text-xs uppercase tracking-wider text-[var(--ink)] font-mono">
                                {det.label}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded border border-[var(--accent-line)]">
                              {(det.confidence * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div className="w-full bg-[var(--border)] rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${det.confidence * 100}%`,
                                backgroundColor: det.color
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-[var(--faint)] bg-[var(--surface)] p-2 rounded border border-[var(--border)]">
                            <div><span>Box: </span><span className="text-[var(--ink)]">[{det.box.xmin}, {det.box.ymin}]</span></div>
                            <div><span>Size: </span><span className="text-[var(--ink)]">{det.box.width}×{det.box.height}</span></div>
                            <div><span>Rel X: </span><span className="text-[var(--ink)]">{(det.box.rel_xmin * 100).toFixed(1)}%</span></div>
                            <div><span>Rel Y: </span><span className="text-[var(--ink)]">{(det.box.rel_ymin * 100).toFixed(1)}%</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Left Sidebar Drawer */}
      <aside
        className={`fixed top-18 left-4 bottom-6 z-50 w-[340px] max-w-[calc(100vw-32px)] bg-[var(--surface)]/95 border border-[var(--border-strong)] rounded-2xl shadow-[var(--shadow-soft)] backdrop-blur-xl transform transition-all duration-250 ease-out flex flex-col overflow-hidden ${
          historyOpen ? 'translate-x-0 opacity-100' : '-translate-x-[380px] opacity-0 pointer-events-none'
        }`}
      >
        <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]/80">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold tracking-tight text-[var(--ink)] font-['Space_Grotesk']">
              Detection History
            </h2>
            <span className="font-mono text-[11px] text-[var(--faint)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {historyItems.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {historyItems.length > 0 && (
              <button
                onClick={clearAllHistory}
                title="Clear all history"
                className="p-1 rounded-md text-[var(--faint)] hover:text-red-400 hover:bg-[var(--surface)] transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(false)}
              className="p-1 rounded-md text-[var(--faint)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-all cursor-pointer"
              title="Close history panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {historyItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--faint)]">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] opacity-60 mb-2.5">
                <History className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-[var(--muted)]">No detection history</p>
              <p className="font-mono text-[11px] text-[var(--faint)] mt-1 max-w-[180px]">
                Run object detection on an image to save records here
              </p>
            </div>
          ) : (
            historyItems.map((item) => (
              <div
                key={item.id}
                onClick={() => loadHistoryItem(item)}
                className="group relative p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]/70 hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]/50 transition-all cursor-pointer flex gap-2.5 items-center"
              >
                <div className="w-14 h-14 rounded-md overflow-hidden bg-[var(--surface)] border border-[var(--border)] shrink-0 flex items-center justify-center">
                  <img
                    src={item.result?.annotated_image_base64 || item.previewUrl}
                    alt="History entry"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--ink)] truncate max-w-[130px]">
                      {item.fileName}
                    </p>
                    <button
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      title="Delete record"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[var(--faint)] hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--faint)]">
                    <span className="text-[var(--accent)] font-semibold">
                      {item.latency}ms
                    </span>
                    <span>·</span>
                    <span>{item.summary}</span>
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[var(--faint)] group-hover:text-[var(--accent)] shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
            ))
          )}
        </div>

        {historyItems.length > 0 && (
          <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-2)]/80 text-center font-mono text-[10px] text-[var(--faint)]">
            Click entry to restore view
          </div>
        )}
      </aside>

      {/* Multi-Format ML Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)] font-['Space_Grotesk']">
                    Export Annotations for Machine Learning
                  </h3>
                  <p className="text-xs text-[var(--faint)] font-mono">
                    {result?.detected_count || 0} objects detected in {selectedFile?.name || 'image'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setExportModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--faint)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Format Selector Tabs */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex gap-2">
              <button
                onClick={() => setExportFormat('yolo')}
                className={`flex-1 p-2.5 rounded-xl border font-mono text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  exportFormat === 'yolo'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-bold shadow-sm'
                    : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-line)]'
                }`}
              >
                <span className="text-sm">🎯 YOLO</span>
                <span className="text-[10px] text-[var(--faint)]">Normalized Coordinates (.txt)</span>
              </button>

              <button
                onClick={() => setExportFormat('coco')}
                className={`flex-1 p-2.5 rounded-xl border font-mono text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  exportFormat === 'coco'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-bold shadow-sm'
                    : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-line)]'
                }`}
              >
                <span className="text-sm">📦 COCO JSON</span>
                <span className="text-[10px] text-[var(--faint)]">Standard Dataset (.json)</span>
              </button>

              <button
                onClick={() => setExportFormat('csv')}
                className={`flex-1 p-2.5 rounded-xl border font-mono text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  exportFormat === 'csv'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-bold shadow-sm'
                    : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-line)]'
                }`}
              >
                <span className="text-sm">📊 CSV Table</span>
                <span className="text-[10px] text-[var(--faint)]">Spreadsheet (.csv)</span>
              </button>
            </div>

            {/* Preview Code Box */}
            <div className="flex-1 p-4 overflow-y-auto bg-[var(--bg-2)] font-mono text-xs">
              <div className="relative">
                <pre className="text-[var(--ink)] leading-relaxed whitespace-pre-wrap select-all p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-x-auto max-h-[300px]">
                  {getExportContent()}
                </pre>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-[var(--faint)]">
                Format: <strong className="text-[var(--ink)] uppercase">{exportFormat}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="px-3.5 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent-line)] text-[var(--ink)] font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--green)]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>

                <button
                  onClick={downloadAnnotationFile}
                  className="px-4 py-2 rounded-lg border border-[var(--accent-fill)] bg-[var(--accent-fill)] hover:bg-[var(--accent-fill-hover)] text-[var(--accent-ink)] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[var(--glow)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg)] py-5 text-center font-mono text-xs text-[var(--faint)]">
        VisionTracker · Powered by <span className="text-[var(--accent)]">facebook/detr-resnet-50</span> Transformers
      </footer>
    </div>
  );
}
