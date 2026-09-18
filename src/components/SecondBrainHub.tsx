import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Download,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Sparkles,
  RefreshCw,
  Zap,
  Plus,
  Trash2,
  Bookmark,
  Share2,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Pin,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Globe,
  Chrome,
  Terminal,
  Cpu,
  Eye,
  Sliders,
  Maximize2,
  Cloud
} from 'lucide-react';
import {
  SecondBrainNote,
  SecondBrainClip,
  SecondBrainCategory,
  MinerviniTradeSetup
} from '../types';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToSecondBrainNotes,
  saveSecondBrainNoteToCloud,
  deleteSecondBrainNoteFromCloud,
  subscribeToSecondBrainClips,
  saveSecondBrainClipToCloud,
  deleteSecondBrainClipFromCloud,
  syncLocalSecondBrainToCloud,
  syncBackendClipsToFirestore
} from '../lib/firestoreService';
import {
  getSecondBrainNotes,
  saveSecondBrainNotes,
  getSecondBrainClips,
  saveSecondBrainClips,
  buildSecondBrainGraphData,
  exportSecondBrainToObsidianMarkdown
} from '../utils/secondBrainStorage';
import { downloadChromeExtensionZip } from '../utils/chromeExtensionZip';

interface SecondBrainHubProps {
  stocks: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  isObsidian?: boolean;
}

export const SecondBrainHub: React.FC<SecondBrainHubProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onViewChart,
  isObsidian = true
}) => {
  // Main Sub-Tab Mode
  const [activeSubTab, setActiveSubTab] = useState<'VAULT' | 'GRAPH' | 'EXTENSION' | 'SYNTHESIZER'>('VAULT');

  // Notes & Clips State
  const [notes, setNotes] = useState<SecondBrainNote[]>(() => getSecondBrainNotes());
  const [clips, setClips] = useState<SecondBrainClip[]>(() => getSecondBrainClips());
  const [selectedCategory, setSelectedCategory] = useState<SecondBrainCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Note Selection & Editing State
  const [activeNote, setActiveNote] = useState<SecondBrainNote | null>(() => notes[0] || null);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New / Edit Note Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<SecondBrainCategory>('PROJECTS');
  const [formTicker, setFormTicker] = useState<string>('');
  const [formPattern, setFormPattern] = useState<string>('VCP (3 Contractions)');
  const [formTags, setFormTags] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');

  // Gemini Synthesizer State
  const [synthText, setSynthText] = useState<string>('');
  const [synthTicker, setSynthTicker] = useState<string>(selectedStock?.ticker || '');
  const [synthCategory, setSynthCategory] = useState<SecondBrainCategory>('PROJECTS');
  const [synthSource, setSynthSource] = useState<string>('Web Clipping / TradingView');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // In-App Web Clipper Simulator State
  const [clipSimUrl, setClipSimUrl] = useState<string>('https://www.tradingview.com/chart/?symbol=NASDAQ:NVDA');
  const [clipSimTicker, setClipSimTicker] = useState<string>(selectedStock?.ticker || 'NVDA');
  const [clipSimTitle, setClipSimTitle] = useState<string>('NVDA Testing 21 EMA with Volume Dry-Up');
  const [clipSimText, setClipSimText] = useState<string>('Observed tight volume dry-up near 50-day average. VCP contracting into 3rd wave with buyers defending $128 level.');
  const [clipSimCategory, setClipSimCategory] = useState<SecondBrainCategory>('PROJECTS');
  const [clipSimSource, setClipSimSource] = useState<string>('TradingView');

  // Canvas Graph Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // User Auth & Cloud Sync
  const { user, signIn } = useAuth();
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Firestore Real-Time Synchronization
  useEffect(() => {
    if (!user) return;

    // Migrate initial local items to Firestore if not already present
    syncLocalSecondBrainToCloud(user.uid, notes, clips).catch(console.error);

    // Subscribe to cloud notes
    const unsubNotes = subscribeToSecondBrainNotes(
      user.uid,
      (cloudNotes) => {
        if (cloudNotes.length > 0) {
          setNotes(cloudNotes);
          saveSecondBrainNotes(cloudNotes);
          setActiveNote((prev) => {
            if (!prev) return cloudNotes[0];
            const updated = cloudNotes.find((n) => n.id === prev.id);
            return updated || cloudNotes[0];
          });
        }
      },
      (err) => console.warn('Firestore notes subscription error:', err)
    );

    // Subscribe to cloud clips
    const unsubClips = subscribeToSecondBrainClips(
      user.uid,
      (cloudClips) => {
        if (cloudClips.length > 0) {
          setClips(cloudClips);
          saveSecondBrainClips(cloudClips);
        }
      },
      (err) => console.warn('Firestore clips subscription error:', err)
    );

    return () => {
      unsubNotes();
      unsubClips();
    };
  }, [user]);

  // Sync with API clips on mount and periodically (from Chrome Extension)
  useEffect(() => {
    fetchClipsFromApi();
    const interval = setInterval(fetchClipsFromApi, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Save notes locally whenever updated
  useEffect(() => {
    saveSecondBrainNotes(notes);
  }, [notes]);

  // Save clips locally whenever updated
  useEffect(() => {
    saveSecondBrainClips(clips);
  }, [clips]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchClipsFromApi = async () => {
    try {
      const res = await fetch('/api/second-brain/clips');
      if (res.ok) {
        const data = await res.json();
        if (data.clips && Array.isArray(data.clips)) {
          setClips(data.clips);
          // If authenticated, sync any newly retrieved extension clips to Firestore
          if (user) {
            syncBackendClipsToFirestore(user.uid, data.clips).catch(console.error);
          }
        }
      }
    } catch (e) {
      // Offline fallback already in state
    }
  };

  const handleManualCloudSync = async () => {
    if (!user) {
      signIn();
      return;
    }
    setIsCloudSyncing(true);
    try {
      await syncLocalSecondBrainToCloud(user.uid, notes, clips);
      await fetchClipsFromApi();
      showToast('Second Brain P.A.R.A vault successfully synced with Firestore!');
    } catch (err: any) {
      showToast('Cloud sync error: ' + err.message);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Download Chrome Extension ZIP
  const handleDownloadExtension = async () => {
    setIsDownloadingZip(true);
    try {
      await downloadChromeExtensionZip();
      showToast('Chrome Extension ZIP package downloaded! Extract and click "Load unpacked" in chrome://extensions');
    } catch (err: any) {
      console.error(err);
      showToast('Error generating ZIP: ' + err.message);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Filtered Notes
  const filteredNotes = notes.filter((n) => {
    const matchesCat = selectedCategory === 'ALL' || n.category === selectedCategory;
    const matchesTag = !selectedTag || n.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.ticker && n.ticker.toLowerCase().includes(searchQuery.toLowerCase())) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesTag && matchesSearch;
  });

  // All distinct tags for filter pills
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags)));

  // Start Creating a New Note
  const handleOpenCreateNote = () => {
    setIsCreatingNote(true);
    setIsEditingNote(false);
    setFormTitle(selectedStock ? `${selectedStock.ticker} — VCP Setup Thesis` : '');
    setFormCategory('PROJECTS');
    setFormTicker(selectedStock ? selectedStock.ticker : '');
    setFormPattern(selectedStock?.patternType || 'VCP (3 Contractions)');
    setFormTags('#active-campaign, #vcp');
    setFormContent(
      selectedStock
        ? `## 🎯 ${selectedStock.ticker} Setup Overview\n- **Pattern**: ${selectedStock.patternType}\n- **Pivot Level**: $${selectedStock.pivotPrice}\n- **Volume Dry-Up**: ${selectedStock.volumeDryUpPercent}%\n- **Risk Protocol**: Stop loss at $${selectedStock.stopLossPrice} (-${selectedStock.stopLossPercent}%)\n\n**Linked**: [[${selectedStock.ticker}]] • [[VCP]] • [[Trend Template]]`
        : '## 📝 Note Content\n\nAdd your trading notes, observations, and rules here.\n\n**Linked**: [[Watchlist]] • [[Risk Management]]'
    );
  };

  // Start Editing Active Note
  const handleOpenEditNote = (note: SecondBrainNote) => {
    setIsEditingNote(true);
    setIsCreatingNote(false);
    setFormTitle(note.title);
    setFormCategory(note.category);
    setFormTicker(note.ticker || '');
    setFormPattern(note.patternType || '');
    setFormTags(note.tags.join(', '));
    setFormContent(note.content);
  };

  // Save New or Edited Note
  const handleSaveNoteForm = () => {
    if (!formTitle.trim()) {
      showToast('Please specify a title for the note');
      return;
    }

    const cleanTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    // Extract wikilinks
    const wikilinks = formContent.match(/\[\[(.*?)\]\]/g) || [];

    if (isCreatingNote) {
      const newNote: SecondBrainNote = {
        id: 'note-' + Date.now(),
        title: formTitle.trim(),
        category: formCategory,
        ticker: formTicker.trim().toUpperCase() || undefined,
        patternType: formPattern || undefined,
        tags: cleanTags.length > 0 ? cleanTags : ['#second-brain'],
        content: formContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceType: 'MANUAL',
        isPinned: false,
        sepaRating: 'LEADER',
        wikilinks
      };
      setNotes([newNote, ...notes]);
      setActiveNote(newNote);
      setIsCreatingNote(false);
      if (user) {
        saveSecondBrainNoteToCloud(user.uid, newNote).catch(console.error);
      }
      showToast('Created new note in ' + formCategory + (user ? ' (Synced to Cloud)' : ''));
    } else if (isEditingNote && activeNote) {
      const updatedNote: SecondBrainNote = {
        ...activeNote,
        title: formTitle.trim(),
        category: formCategory,
        ticker: formTicker.trim().toUpperCase() || undefined,
        patternType: formPattern || undefined,
        tags: cleanTags,
        content: formContent,
        updatedAt: new Date().toISOString(),
        wikilinks
      };
      const updatedNotes = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
      setNotes(updatedNotes);
      setActiveNote(updatedNote);
      setIsEditingNote(false);
      if (user) {
        saveSecondBrainNoteToCloud(user.uid, updatedNote).catch(console.error);
      }
      showToast('Saved note changes' + (user ? ' (Synced to Cloud)' : ''));
    }
  };

  // Delete Note
  const handleDeleteNote = (id: string) => {
    if (confirm('Delete this Second Brain note?')) {
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeNote?.id === id) {
        setActiveNote(remaining[0] || null);
      }
      if (user) {
        deleteSecondBrainNoteFromCloud(user.uid, id).catch(console.error);
      }
      showToast('Note deleted');
    }
  };

  // Toggle Pin Note
  const handleTogglePin = (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    const updated = { ...target, isPinned: !target.isPinned, updatedAt: new Date().toISOString() };
    setNotes(notes.map((n) => (n.id === id ? updated : n)));
    if (activeNote?.id === id) {
      setActiveNote(updated);
    }
    if (user) {
      saveSecondBrainNoteToCloud(user.uid, updated).catch(console.error);
    }
  };

  // Copy Obsidian Markdown Note
  const handleCopyMarkdown = (note: SecondBrainNote) => {
    const md = `---
title: "${note.title}"
category: "${note.category}"
ticker: "${note.ticker || ''}"
tags: [${note.tags.join(', ')}]
created: "${note.createdAt}"
updated: "${note.updatedAt}"
---

# ${note.title}

${note.content}

---
*Minervini SEPA Second Brain*`;

    navigator.clipboard.writeText(md).then(() => {
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Copied Obsidian Markdown with YAML frontmatter!');
    });
  };

  // Export Entire Second Brain Vault to Markdown File
  const handleExportVaultMarkdown = () => {
    const fullMd = exportSecondBrainToObsidianMarkdown(notes);
    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minervini-second-brain-vault-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported entire Second Brain knowledge vault to Markdown');
  };

  // Submit In-App Clipper Form (Simulates Chrome Extension clip)
  const handleSimulateClip = async () => {
    if (!clipSimTitle.trim() || !clipSimText.trim()) {
      showToast('Please provide a title and note text');
      return;
    }

    const payload: SecondBrainClip = {
      id: 'clip-' + Date.now(),
      title: clipSimTitle.trim(),
      url: clipSimUrl.trim(),
      ticker: clipSimTicker.trim().toUpperCase() || undefined,
      source: clipSimSource,
      content: clipSimText.trim(),
      category: clipSimCategory,
      tags: [
        `#${clipSimSource.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        clipSimTicker ? `#${clipSimTicker.toLowerCase()}` : '#setup',
        '#web-clip'
      ],
      timestamp: new Date().toISOString(),
      status: 'UNPROCESSED'
    };

    try {
      const res = await fetch('/api/second-brain/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setClips([payload, ...clips]);
        if (user) {
          saveSecondBrainClipToCloud(user.uid, payload).catch(console.error);
        }
        showToast('✓ Successfully clipped to Second Brain API' + (user ? ' & Firestore!' : '!'));
      } else {
        setClips([payload, ...clips]);
        if (user) {
          saveSecondBrainClipToCloud(user.uid, payload).catch(console.error);
        }
        showToast('Saved clip locally in app');
      }
    } catch (e) {
      setClips([payload, ...clips]);
      if (user) {
        saveSecondBrainClipToCloud(user.uid, payload).catch(console.error);
      }
      showToast('Saved clip locally in app');
    }
  };

  // Convert Clip to Full Second Brain Note
  const handleConvertClipToNote = (clip: SecondBrainClip) => {
    const newNote: SecondBrainNote = {
      id: 'note-from-clip-' + Date.now(),
      title: clip.title,
      category: clip.category,
      ticker: clip.ticker,
      tags: [...clip.tags, '#promoted-clip'],
      content: `## 🌐 Clipped from ${clip.source}\n> **Source URL**: [${clip.url}](${clip.url})\n> **Captured**: ${new Date(clip.timestamp).toLocaleString()}\n\n${clip.content}\n\n---\n**Linked**: [[${clip.ticker || 'Watchlist'}]] • [[Web Research]]`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: 'CHROME_EXTENSION',
      isPinned: false,
      sepaRating: 'LEADER',
      wikilinks: clip.ticker ? [`[[${clip.ticker}]]`] : []
    };
    setNotes([newNote, ...notes]);
    setActiveNote(newNote);
    setActiveSubTab('VAULT');
    if (user) {
      saveSecondBrainNoteToCloud(user.uid, newNote).catch(console.error);
    }
    showToast(`Converted clip "${clip.title}" into a permanent Second Brain note!`);
  };

  // Delete Clip
  const handleDeleteClip = async (id: string) => {
    try {
      await fetch(`/api/second-brain/clip/${id}`, { method: 'DELETE' });
    } catch (e) {}
    setClips(clips.filter((c) => c.id !== id));
    if (user) {
      deleteSecondBrainClipFromCloud(user.uid, id).catch(console.error);
    }
    showToast('Clip removed');
  };

  // Gemini AI Synthesize Action
  const handleSynthesizeWithGemini = async () => {
    if (!synthText.trim()) {
      showToast('Please input some raw notes or research text to synthesize');
      return;
    }
    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/second-brain/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: synthText,
          ticker: synthTicker || undefined,
          category: synthCategory,
          source: synthSource,
          title: synthTicker ? `${synthTicker} Minervini SEPA Synthesis` : 'Trading Synthesis'
        })
      });

      const data = await res.json();
      if (data.note) {
        const aiNote: SecondBrainNote = {
          id: 'note-synth-' + Date.now(),
          title: data.note.title || `${synthTicker} SEPA AI Synthesis`,
          category: data.note.category || synthCategory,
          ticker: data.note.ticker || synthTicker || undefined,
          tags: data.note.tags || ['#gemini-ai', '#sepa-synthesis'],
          content: data.note.markdown || synthText,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceType: 'GEMINI_AI',
          isPinned: true,
          sepaRating: 'ELITE',
          wikilinks: data.note.wikilinks || []
        };
        setNotes([aiNote, ...notes]);
        setActiveNote(aiNote);
        setActiveSubTab('VAULT');
        if (user) {
          saveSecondBrainNoteToCloud(user.uid, aiNote).catch(console.error);
        }
        showToast('Gemini AI synthesized and created your Second Brain note!');
      }
    } catch (err: any) {
      showToast('AI synthesis completed with offline SEPA template');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // -------------------------------------------------------------------------
  // INTERACTIVE GRAPH VISUALIZER RENDER
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeSubTab !== 'GRAPH') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const graphData = buildSecondBrainGraphData(notes, stocks);

    // Initial node layout with radial distribution
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodePositions = graphData.nodes.map((node, i) => {
      if (node.id === 'SEPA_BRAIN') {
        return { ...node, x: centerX, y: centerY, vx: 0, vy: 0 };
      }
      if (node.id.startsWith('CAT_')) {
        const catIdx = ['CAT_PROJECTS', 'CAT_AREAS', 'CAT_RESOURCES', 'CAT_ARCHIVES'].indexOf(node.id);
        const angle = (catIdx / 4) * Math.PI * 2 - Math.PI / 4;
        return {
          ...node,
          x: centerX + Math.cos(angle) * 140,
          y: centerY + Math.sin(angle) * 140,
          vx: 0,
          vy: 0
        };
      }
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const radius = 220 + (i % 3) * 45;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      };
    });

    // Draw loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Background grid dots
      ctx.fillStyle = isObsidian ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
      for (let x = 20; x < width; x += 30) {
        for (let y = 20; y < height; y += 30) {
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }

      // Draw links
      ctx.lineWidth = 1;
      graphData.links.forEach((link) => {
        const sourceNode = nodePositions.find((n) => n.id === link.source);
        const targetNode = nodePositions.find((n) => n.id === link.target);
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.strokeStyle =
            link.source === 'SEPA_BRAIN'
              ? 'rgba(245, 158, 11, 0.4)'
              : isObsidian
              ? 'rgba(148, 163, 184, 0.2)'
              : 'rgba(100, 116, 139, 0.2)';
          ctx.moveTo(sourceNode.x!, sourceNode.y!);
          ctx.lineTo(targetNode.x!, targetNode.y!);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodePositions.forEach((node) => {
        ctx.beginPath();
        const radius = node.type === 'CONCEPT' && node.id === 'SEPA_BRAIN' ? 18 : node.type === 'TICKER' ? 14 : 10;
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);

        // Fill color based on node type
        if (node.id === 'SEPA_BRAIN') {
          ctx.fillStyle = '#f59e0b';
        } else if (node.type === 'TICKER') {
          ctx.fillStyle = '#10b981';
        } else if (node.category === 'PROJECTS') {
          ctx.fillStyle = '#3b82f6';
        } else if (node.category === 'AREAS') {
          ctx.fillStyle = '#8b5cf6';
        } else if (node.category === 'RESOURCES') {
          ctx.fillStyle = '#ec4899';
        } else {
          ctx.fillStyle = '#64748b';
        }
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = isObsidian ? '#0f172a' : '#ffffff';
        ctx.stroke();

        // Node Label
        ctx.font = node.id === 'SEPA_BRAIN' ? 'bold 12px sans-serif' : '10px sans-serif';
        ctx.fillStyle = isObsidian ? '#f1f5f9' : '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x!, node.y! + radius + 12);
      });
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [activeSubTab, notes, isObsidian]);

  return (
    <div className="space-y-6">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-black px-4 py-3 rounded-lg shadow-2xl font-bold flex items-center space-x-2 border-2 border-amber-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-black" />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Hub Controls */}
      <div className={`p-6 border rounded-xl shadow-sm ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-black shadow-md">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-xl font-bold font-serif flex items-center space-x-2 ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                  <span>Minervini SEPA Second Brain</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                    P.A.R.A Framework
                  </span>
                  {user ? (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono flex items-center space-x-1">
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span>Firestore Synced</span>
                    </span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300/80 border border-amber-500/20 font-mono flex items-center space-x-1">
                      <Cloud className="w-3 h-3 text-amber-400" />
                      <span>Local Vault</span>
                    </span>
                  )}
                </h2>
                <p className={`text-xs ${isObsidian ? 'text-gray-400' : 'text-gray-600'}`}>
                  Centralized trading intelligence repository, bidirectional wikilink graph, and 1-click Chrome Extension web clipper synced with Firestore.
                </p>
              </div>
            </div>
          </div>

          {/* Hub Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualCloudSync}
              disabled={isCloudSyncing}
              className={`px-3 py-2 border font-mono font-bold text-xs rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                user
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
              }`}
              title={user ? 'Sync vault with Firestore cloud database' : 'Sign in to sync vault to Firestore cloud'}
            >
              <Cloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : user ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>{isCloudSyncing ? 'Syncing...' : user ? 'Sync Cloud Vault' : 'Sign In to Sync'}</span>
            </button>

            <button
              onClick={handleDownloadExtension}
              disabled={isDownloadingZip}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-md shadow flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Download unpacked Chrome Extension (.zip)"
            >
              <Chrome className="w-4 h-4" />
              <span>{isDownloadingZip ? 'Packing ZIP...' : 'Download Chrome Extension'}</span>
            </button>

            <button
              onClick={handleOpenCreateNote}
              className={`px-3 py-2 border font-bold text-xs rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                isObsidian
                  ? 'bg-[#181f2c] border-[#2b374d] text-white hover:bg-[#202a3c]'
                  : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-4 h-4 text-amber-500" />
              <span>New Brain Note</span>
            </button>

            <button
              onClick={handleExportVaultMarkdown}
              className={`px-3 py-2 border font-bold text-xs rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                isObsidian
                  ? 'bg-[#181f2c] border-[#2b374d] text-white hover:bg-[#202a3c]'
                  : 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
              }`}
              title="Export all Second Brain notes into Markdown files for Obsidian"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export to Obsidian (.md)</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs: Vault, Knowledge Graph, Chrome Extension, Synthesizer */}
        <div className="flex items-center space-x-1 mt-6 border-b border-[#202838] overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveSubTab('VAULT')}
            className={`px-4 py-2 font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeSubTab === 'VAULT'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>P.A.R.A Knowledge Vault ({notes.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('GRAPH')}
            className={`px-4 py-2 font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeSubTab === 'GRAPH'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Interactive Knowledge Graph</span>
          </button>

          <button
            onClick={() => setActiveSubTab('EXTENSION')}
            className={`px-4 py-2 font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeSubTab === 'EXTENSION'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Chrome className="w-4 h-4" />
            <span>Chrome Extension &amp; Web Clips ({clips.length})</span>
            {clips.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('SYNTHESIZER')}
            className={`px-4 py-2 font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeSubTab === 'SYNTHESIZER'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Gemini AI Synthesizer</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: P.A.R.A KNOWLEDGE VAULT & NOTE EDITOR */}
      {/* ===================================================================== */}
      {activeSubTab === 'VAULT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Notes List & Filter Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Search and Category Filters */}
            <div className={`p-4 border rounded-xl space-y-3 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes, tickers, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded border outline-none ${
                    isObsidian
                      ? 'bg-[#181f2c] border-[#2b374d] text-white placeholder-gray-500 focus:border-amber-400'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-gray-400 focus:border-amber-500'
                  }`}
                />
              </div>

              {/* P.A.R.A Category Buttons */}
              <div className="grid grid-cols-5 gap-1 text-[11px] font-bold">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`py-1.5 rounded text-center transition-all ${
                    selectedCategory === 'ALL'
                      ? 'bg-amber-500 text-black'
                      : isObsidian
                      ? 'bg-[#181f2c] text-gray-300 hover:text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedCategory('PROJECTS')}
                  className={`py-1.5 rounded text-center transition-all ${
                    selectedCategory === 'PROJECTS'
                      ? 'bg-blue-600 text-white'
                      : isObsidian
                      ? 'bg-[#181f2c] text-blue-300'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                  title="Active Trade Campaigns"
                >
                  🎯 Proj
                </button>
                <button
                  onClick={() => setSelectedCategory('AREAS')}
                  className={`py-1.5 rounded text-center transition-all ${
                    selectedCategory === 'AREAS'
                      ? 'bg-purple-600 text-white'
                      : isObsidian
                      ? 'bg-[#181f2c] text-purple-300'
                      : 'bg-purple-50 text-purple-700'
                  }`}
                  title="SEPA Rules & Disciplines"
                >
                  🛡️ Area
                </button>
                <button
                  onClick={() => setSelectedCategory('RESOURCES')}
                  className={`py-1.5 rounded text-center transition-all ${
                    selectedCategory === 'RESOURCES'
                      ? 'bg-emerald-600 text-white'
                      : isObsidian
                      ? 'bg-[#181f2c] text-emerald-300'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                  title="Knowledge Base & Gurus"
                >
                  📚 Res
                </button>
                <button
                  onClick={() => setSelectedCategory('ARCHIVES')}
                  className={`py-1.5 rounded text-center transition-all ${
                    selectedCategory === 'ARCHIVES'
                      ? 'bg-gray-600 text-white'
                      : isObsidian
                      ? 'bg-[#181f2c] text-gray-300'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  title="Past Case Studies & Lessons"
                >
                  📦 Arch
                </button>
              </div>

              {/* Tag Filter Pills */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                  {selectedTag && (
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold"
                    >
                      Clear tag
                    </button>
                  )}
                  {allTags.slice(0, 10).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                        selectedTag === t
                          ? 'bg-amber-400 text-black font-bold'
                          : isObsidian
                          ? 'bg-[#181f2c] text-gray-400 hover:text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 ? (
                <div className={`p-8 text-center border rounded-xl text-xs ${isObsidian ? 'border-[#202838] text-gray-500' : 'border-gray-200 text-gray-500'}`}>
                  No Second Brain notes match the current filters.
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = activeNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setActiveNote(note);
                        setIsEditingNote(false);
                        setIsCreatingNote(false);
                      }}
                      className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? isObsidian
                            ? 'bg-[#182133] border-amber-400/80 shadow-md'
                            : 'bg-amber-50/50 border-amber-500 shadow-sm'
                          : isObsidian
                          ? 'bg-[#0f1218] border-[#202838] hover:border-gray-600'
                          : 'bg-white border-[#e5e4e1] hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            {note.isPinned && (
                              <Pin className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                            )}
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase font-mono ${
                                note.category === 'PROJECTS'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : note.category === 'AREAS'
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : note.category === 'RESOURCES'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              }`}
                            >
                              {note.category}
                            </span>
                            {note.ticker && (
                              <span className="text-xs font-mono font-bold text-amber-400">
                                ${note.ticker}
                              </span>
                            )}
                          </div>
                          <h4 className={`text-xs font-bold line-clamp-1 ${isObsidian ? 'text-gray-100' : 'text-slate-900'}`}>
                            {note.title}
                          </h4>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note.id);
                          }}
                          className="text-gray-400 hover:text-amber-400 p-1"
                        >
                          <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'text-amber-400 fill-current' : ''}`} />
                        </button>
                      </div>

                      <p className={`text-[11px] line-clamp-2 mt-1.5 ${isObsidian ? 'text-gray-400' : 'text-gray-600'}`}>
                        {note.content.replace(/#+\s+/g, '').replace(/\*+/g, '')}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/40 text-[10px] text-gray-500">
                        <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                        <div className="flex items-center space-x-1">
                          {note.sourceType === 'CHROME_EXTENSION' && (
                            <span className="text-[9px] text-emerald-400 font-bold">Clipped</span>
                          )}
                          {note.sourceType === 'GEMINI_AI' && (
                            <span className="text-[9px] text-purple-400 font-bold">Gemini AI</span>
                          )}
                          {note.wikilinks && note.wikilinks.length > 0 && (
                            <span className="text-[9px] text-amber-400 font-mono">
                              {note.wikilinks.length} links
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Note Viewer / Editor */}
          <div className="lg:col-span-8">
            {isCreatingNote || isEditingNote ? (
              /* Note Form Editor */
              <div className={`p-6 border rounded-xl space-y-4 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
                <div className="flex items-center justify-between border-b border-[#202838] pb-3">
                  <h3 className={`text-base font-bold flex items-center space-x-2 ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>{isCreatingNote ? 'Create New Second Brain Note' : 'Edit Second Brain Note'}</span>
                  </h3>
                  <button
                    onClick={() => {
                      setIsCreatingNote(false);
                      setIsEditingNote(false);
                    }}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 mb-1">Note Title</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. NVDA — High Tight Flag & AI Infrastructure Thesis"
                      className={`w-full p-2 text-xs rounded border outline-none ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">P.A.R.A Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as SecondBrainCategory)}
                      className={`w-full p-2 text-xs rounded border outline-none ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="PROJECTS">🎯 Projects (Active Trades)</option>
                      <option value="AREAS">🛡️ Areas (SEPA Rules)</option>
                      <option value="RESOURCES">📚 Resources (Knowledge)</option>
                      <option value="ARCHIVES">📦 Archives (Post-Mortem)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Ticker (Optional)</label>
                    <input
                      type="text"
                      value={formTicker}
                      onChange={(e) => setFormTicker(e.target.value)}
                      placeholder="e.g. NVDA, TRENT"
                      className={`w-full p-2 text-xs rounded border outline-none font-mono uppercase text-amber-400 font-bold ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d]' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Pattern Type</label>
                    <input
                      type="text"
                      value={formPattern}
                      onChange={(e) => setFormPattern(e.target.value)}
                      placeholder="e.g. VCP (3 Contractions)"
                      className={`w-full p-2 text-xs rounded border outline-none ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Tags (Comma separated)</label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="#vcp, #semiconductors, #rules"
                      className={`w-full p-2 text-xs rounded border outline-none font-mono ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-400">
                      Markdown Note Body (Supports [[Wikilinks]], callouts, tables)
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">Tip: Use [[Ticker]] or [[Concept]]</span>
                  </div>
                  <textarea
                    rows={14}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className={`w-full p-3 font-mono text-xs rounded border outline-none ${
                      isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => {
                      setIsCreatingNote(false);
                      setIsEditingNote(false);
                    }}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNoteForm}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded shadow"
                  >
                    Save Note to Second Brain
                  </button>
                </div>
              </div>
            ) : activeNote ? (
              /* Note Detail View */
              <div className={`p-6 border rounded-xl space-y-5 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#202838] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase font-mono ${
                          activeNote.category === 'PROJECTS'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : activeNote.category === 'AREAS'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : activeNote.category === 'RESOURCES'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}
                      >
                        {activeNote.category}
                      </span>
                      {activeNote.ticker && (
                        <span className="text-sm font-mono font-bold text-amber-400">
                          ${activeNote.ticker}
                        </span>
                      )}
                      {activeNote.patternType && (
                        <span className="text-xs text-gray-400 font-sans">
                          • {activeNote.patternType}
                        </span>
                      )}
                    </div>
                    <h2 className={`text-lg font-bold font-serif ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                      {activeNote.title}
                    </h2>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center space-x-2">
                    {activeNote.ticker && onViewChart && (
                      <button
                        onClick={() => {
                          const matchStock = stocks.find((s) => s.ticker === activeNote.ticker);
                          if (matchStock) onViewChart(matchStock);
                        }}
                        className="px-2.5 py-1 text-xs border rounded font-bold text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Chart</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyMarkdown(activeNote)}
                      className={`p-1.5 border rounded text-xs transition-all ${
                        isObsidian ? 'border-[#2b374d] text-gray-300 hover:text-white' : 'border-gray-300 text-gray-700'
                      }`}
                      title="Copy Markdown"
                    >
                      {copiedId === activeNote.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEditNote(activeNote)}
                      className={`px-3 py-1 text-xs border rounded font-bold transition-all ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white hover:bg-[#202a3c]' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      Edit Note
                    </button>

                    <button
                      onClick={() => handleDeleteNote(activeNote.id)}
                      className="p-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded"
                      title="Delete Note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tags & Wikilinks ribbon */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {activeNote.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-gray-800/60 text-gray-300 font-mono text-[10px]"
                    >
                      {t}
                    </span>
                  ))}
                  {activeNote.wikilinks &&
                    activeNote.wikilinks.map((wl) => (
                      <span
                        key={wl}
                        className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-mono text-[10px]"
                      >
                        {wl}
                      </span>
                    ))}
                </div>

                {/* Note Rendered Body */}
                <div className={`p-5 rounded-lg border leading-relaxed font-sans text-xs ${
                  isObsidian ? 'bg-[#141922] border-[#202838] text-gray-200' : 'bg-slate-50 border-gray-200 text-slate-800'
                }`}>
                  <div className="prose prose-invert max-w-none space-y-3">
                    {activeNote.content.split('\n\n').map((block, idx) => {
                      if (block.startsWith('> [!')) {
                        return (
                          <div
                            key={idx}
                            className="p-3 my-2 border-l-4 border-amber-400 bg-amber-500/10 rounded-r text-amber-200 text-xs"
                          >
                            {block.replace(/> \[!(.*?)\]\s*/g, '')}
                          </div>
                        );
                      }
                      if (block.startsWith('## ')) {
                        return (
                          <h3 key={idx} className="text-sm font-bold text-amber-400 pt-2 border-b border-gray-800/40 pb-1">
                            {block.replace('## ', '')}
                          </h3>
                        );
                      }
                      if (block.startsWith('### ')) {
                        return (
                          <h4 key={idx} className="text-xs font-bold text-white pt-1">
                            {block.replace('### ', '')}
                          </h4>
                        );
                      }
                      return (
                        <p key={idx} className="whitespace-pre-line">
                          {block}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* Obsidian URI Integration Action */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-800/40 text-gray-400">
                  <span className="font-mono text-[10px]">
                    Vault Target: "Growth Stock Alpha" • Bidirectional Obsidian Linking Active
                  </span>
                  <a
                    href={`obsidian://new?vault=Growth%20Stock%20Alpha&name=${encodeURIComponent(activeNote.title)}&content=${encodeURIComponent(activeNote.content)}`}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1"
                  >
                    <span>Open in Obsidian App</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className={`p-12 text-center border rounded-xl ${isObsidian ? 'border-[#202838] text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                Select a note from the left or create a new one to view details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: INTERACTIVE KNOWLEDGE GRAPH VISUALIZER */}
      {/* ===================================================================== */}
      {activeSubTab === 'GRAPH' && (
        <div className={`p-6 border rounded-xl space-y-4 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#202838] pb-3">
            <div>
              <h3 className={`text-base font-bold font-serif flex items-center space-x-2 ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Second Brain Bidirectional Knowledge Graph</span>
              </h3>
              <p className="text-xs text-gray-400">
                Visual relationship network linking trade candidates, P.A.R.A categories, SEPA concepts, and wikilinks.
              </p>
            </div>
            {/* Graph Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Core Hub</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Projects</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Areas (Rules)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Tickers &amp; RS Leaders</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <span>Resources</span>
              </span>
            </div>
          </div>

          <div className="relative border border-[#202838] rounded-lg overflow-hidden bg-[#07090e] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={900}
              height={520}
              className="w-full max-w-full block cursor-crosshair"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
            <span>
              Nodes: {notes.length + 5 + Math.min(stocks.length, 8)} | Synced with Obsidian graph view format.
            </span>
            <button
              onClick={() => setActiveSubTab('VAULT')}
              className="text-amber-400 hover:underline font-bold"
            >
              Browse Notes List &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: CHROME EXTENSION HUB & LIVE WEB CLIPPER */}
      {/* ===================================================================== */}
      {activeSubTab === 'EXTENSION' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Extension Install Guide & In-App Clipper Simulator */}
          <div className="lg:col-span-6 space-y-6">
            {/* 3-Step Install Card */}
            <div className={`p-6 border rounded-xl space-y-4 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
              <div className="flex items-center justify-between border-b border-[#202838] pb-3">
                <div className="flex items-center space-x-2">
                  <Chrome className="w-5 h-5 text-amber-400" />
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                    Chrome Extension Quick Install (3 Steps)
                  </h3>
                </div>
                <button
                  onClick={handleDownloadExtension}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded shadow flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-3 p-2.5 rounded bg-[#181f2c] border border-[#2b374d]">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-white">Extract the Downloaded ZIP</h4>
                    <p className="text-gray-400 mt-0.5">
                      Unzip <code className="text-amber-400 font-mono">minervini-sepa-second-brain-chrome-extension.zip</code> to any folder on your computer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-2.5 rounded bg-[#181f2c] border border-[#2b374d]">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-white">Open Browser Extensions Page</h4>
                    <p className="text-gray-400 mt-0.5">
                      Navigate to <code className="text-amber-400 font-mono">chrome://extensions</code> (or <code className="text-amber-400 font-mono">brave://extensions</code>) and toggle <strong className="text-white">Developer mode</strong> ON in the top-right corner.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-2.5 rounded bg-[#181f2c] border border-[#2b374d]">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-white">Click "Load unpacked"</h4>
                    <p className="text-gray-400 mt-0.5">
                      Select the unzipped folder. The Minervini SEPA Second Brain icon (🧠) will immediately appear in your browser toolbar!
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
                <strong>💡 Automatic Detection:</strong> When you browse ChartLink, Finviz, Yahoo Finance, or Twitter/X, clicking the extension auto-detects the ticker, extracts highlighted text, and posts directly to this Second Brain!
              </div>
            </div>

            {/* Live Web Clipper Test Bench */}
            <div className={`p-6 border rounded-xl space-y-4 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
              <div className="flex items-center justify-between border-b border-[#202838] pb-3">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                    Live In-App Web Clipper (Test Bench)
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  ENDPOINT ONLINE
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">Source Platform</label>
                    <select
                      value={clipSimSource}
                      onChange={(e) => setClipSimSource(e.target.value)}
                      className={`w-full p-2 rounded border outline-none ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="ChartLink">ChartLink Chart</option>
                      <option value="Finviz">Finviz Screener</option>
                      <option value="Twitter / X">Twitter / X Post</option>
                      <option value="Yahoo Finance">Yahoo Finance</option>
                      <option value="Substack">Substack Article</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">Ticker Symbol</label>
                    <input
                      type="text"
                      value={clipSimTicker}
                      onChange={(e) => setClipSimTicker(e.target.value)}
                      placeholder="e.g. NVDA"
                      className={`w-full p-2 rounded border outline-none font-mono font-bold uppercase text-amber-400 ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d]' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Article / Setup URL</label>
                  <input
                    type="text"
                    value={clipSimUrl}
                    onChange={(e) => setClipSimUrl(e.target.value)}
                    placeholder="https://..."
                    className={`w-full p-2 rounded border outline-none font-mono ${
                      isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Note Title</label>
                  <input
                    type="text"
                    value={clipSimTitle}
                    onChange={(e) => setClipSimTitle(e.target.value)}
                    placeholder="Title or headline"
                    className={`w-full p-2 rounded border outline-none ${
                      isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Clipped Snippet / Chart Notes</label>
                  <textarea
                    rows={3}
                    value={clipSimText}
                    onChange={(e) => setClipSimText(e.target.value)}
                    placeholder="Paste notes or analysis..."
                    className={`w-full p-2 font-mono rounded border outline-none ${
                      isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">P.A.R.A:</span>
                    {(['PROJECTS', 'AREAS', 'RESOURCES', 'ARCHIVES'] as SecondBrainCategory[]).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setClipSimCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          clipSimCategory === cat ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {cat.slice(0, 4)}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSimulateClip}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow flex items-center space-x-1"
                  >
                    <span>🧠 Clip to Brain</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Real-Time Incoming Web Clips Stream */}
          <div className="lg:col-span-6 space-y-4">
            <div className={`p-6 border rounded-xl space-y-4 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
              <div className="flex items-center justify-between border-b border-[#202838] pb-3">
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center space-x-2 ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                    <span>Incoming Clips Stream</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                      {clips.length} Captured
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Real-time clips arriving from your Chrome Extension and web research.
                  </p>
                </div>

                <button
                  onClick={fetchClipsFromApi}
                  className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
                  title="Refresh clips from server"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Clips List */}
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {clips.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">
                    No web clips received yet. Install the Chrome extension or use the clipper on the left to capture setups!
                  </div>
                ) : (
                  clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`p-4 border rounded-lg space-y-2 ${
                        isObsidian ? 'bg-[#181f2c] border-[#2b374d]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                              {clip.source}
                            </span>
                            {clip.ticker && (
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                ${clip.ticker}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className={`text-xs font-bold ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                            {clip.title}
                          </h4>
                        </div>

                        <button
                          onClick={() => handleDeleteClip(clip.id)}
                          className="text-gray-500 hover:text-red-400 p-1"
                          title="Delete clip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className={`text-xs ${isObsidian ? 'text-gray-300' : 'text-gray-700'}`}>
                        {clip.content}
                      </p>

                      {clip.url && (
                        <a
                          href={clip.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-amber-400 hover:underline flex items-center space-x-1 font-mono truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{clip.url}</span>
                        </a>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-800/40 text-xs">
                        <div className="flex items-center space-x-1">
                          {clip.tags.map((t) => (
                            <span key={t} className="text-[10px] text-gray-400 font-mono">
                              {t}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => handleConvertClipToNote(clip)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-black font-bold text-[11px] transition-all flex items-center space-x-1"
                        >
                          <span>Promote to Second Brain Note</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: GEMINI AI KNOWLEDGE SYNTHESIZER */}
      {/* ===================================================================== */}
      {activeSubTab === 'SYNTHESIZER' && (
        <div className={`p-6 border rounded-xl space-y-6 ${isObsidian ? 'bg-[#0f1218] border-[#202838]' : 'bg-white border-[#e5e4e1]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#202838] pb-4">
            <div>
              <h3 className={`text-base font-bold font-serif flex items-center space-x-2 ${isObsidian ? 'text-white' : 'text-slate-900'}`}>
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Gemini 3.7 Flash Second Brain Knowledge Synthesizer</span>
              </h3>
              <p className="text-xs text-gray-400">
                Transform unstructured trading ideas, messy transcripts, tweets, or chart notes into production-ready Minervini SEPA knowledge cards.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
              SEPA ARCHITECT PROMPT ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Target Ticker</label>
              <input
                type="text"
                value={synthTicker}
                onChange={(e) => setSynthTicker(e.target.value)}
                placeholder="e.g. NVDA, TRENT"
                className={`w-full p-2.5 rounded border outline-none font-mono font-bold uppercase text-amber-400 ${
                  isObsidian ? 'bg-[#181f2c] border-[#2b374d]' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Target P.A.R.A Category</label>
              <select
                value={synthCategory}
                onChange={(e) => setSynthCategory(e.target.value as SecondBrainCategory)}
                className={`w-full p-2.5 rounded border outline-none text-xs ${
                  isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="PROJECTS">🎯 Projects (Active Trade Setup)</option>
                <option value="AREAS">🛡️ Areas (Core Principle &amp; Rule)</option>
                <option value="RESOURCES">📚 Resources (Study &amp; Guru Insight)</option>
                <option value="ARCHIVES">📦 Archives (Trade Post-Mortem)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Source / Citation</label>
              <input
                type="text"
                value={synthSource}
                onChange={(e) => setSynthSource(e.target.value)}
                placeholder="e.g. TradingView, Mark Minervini Podcast"
                className={`w-full p-2.5 rounded border outline-none text-xs ${
                  isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">
              Raw Market Idea, Transcript, Tweet, or Unstructured Notes
            </label>
            <textarea
              rows={8}
              value={synthText}
              onChange={(e) => setSynthText(e.target.value)}
              placeholder="Paste any messy trade idea here: e.g. 'Looking at NVDA after earnings, stock consolidated for 3 weeks on declining volume, bounced off 21 EMA. Wondering about risk reward and what Minervini rules apply to high tight flag setups...'"
              className={`w-full p-3 font-mono text-xs rounded border outline-none ${
                isObsidian ? 'bg-[#181f2c] border-[#2b374d] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400">
              Generates YAML frontmatter, risk-reward ratios, stop loss directives, and bidirectional [[Wikilinks]].
            </span>

            <button
              onClick={handleSynthesizeWithGemini}
              disabled={isSynthesizing}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded shadow flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSynthesizing ? 'Synthesizing with Gemini 3.7...' : 'Synthesize into Second Brain Note'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
