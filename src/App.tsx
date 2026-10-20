/**
 * @file FileLink Bot Interactive Workbench & Telegram Serverless Control Center
 * @description Full-featured Persian UI with Live Bot Simulator, SQLite Inspector,
 * Gemini Science AI Reasoning, Test Suite Runner, and Deployment Center.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Mic,
  RefreshCw,
  Terminal,
  CheckCircle2,
  XCircle,
  Database,
  Shield,
  Dna,
  FileCheck,
  ExternalLink,
  Trash2,
  Clock,
  Eye,
  AlertTriangle,
  Layers,
  Play,
  Copy,
  Check,
  Atom,
  HelpCircle,
  Server,
  Share2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'channel';
  text?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  replyKeyboard?: Array<Array<{ text: string }>>;
  timestamp: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'database' | 'science' | 'tests' | 'deployment'>('simulator');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channelMessages, setChannelMessages] = useState<any[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeUser, setActiveUser] = useState<{ id: number; name: string }>({ id: 1001, name: 'سینا (فرستنده)' });
  const [activeReplyKeyboard, setActiveReplyKeyboard] = useState<any[] | null>(null);

  // Database Inspector state
  const [dbData, setDbData] = useState<any>(null);
  const [activeDbTable, setActiveDbTable] = useState('files');
  const [dbLoading, setDbLoading] = useState(false);

  // Science AI Inspector state
  const [scienceSelectedFile, setScienceSelectedFile] = useState('4hhb_hemoglobin.pdb');
  const [scienceCustomQuery, setScienceCustomQuery] = useState('');
  const [scienceAnalysis, setScienceAnalysis] = useState<string | null>(null);
  const [scienceLoading, setScienceLoading] = useState(false);
  const [scienceModelUsed, setScienceModelUsed] = useState<string>('');

  // Tests state
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testPassed, setTestPassed] = useState<boolean | null>(null);

  // Copy notification
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  useEffect(() => {
    fetchDbState();
    triggerBotCommand('/start');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchDbState() {
    try {
      setDbLoading(true);
      const res = await fetch('/api/db-state');
      const data = await res.json();
      setDbData(data);
    } catch (err) {
      console.error('Failed to load DB state', err);
    } finally {
      setDbLoading(false);
    }
  }

  async function resetDatabase() {
    if (!confirm('آیا از بازنشانی کامل پایگاه‌داده شبیه‌ساز اطمینان دارید؟')) return;
    try {
      await fetch('/api/db-reset', { method: 'POST' });
      setMessages([]);
      setChannelMessages([]);
      await fetchDbState();
      await triggerBotCommand('/start');
    } catch (err) {
      alert('خطا در ریست دیتابیس');
    }
  }

  async function triggerBotCommand(cmdText: string) {
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: cmdText,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/simulate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: Math.floor(Math.random() * 8000) + 100,
            from: { id: activeUser.id, first_name: activeUser.name, username: 'test_user' },
            chat: { id: activeUser.id },
            date: Math.floor(Date.now() / 1000),
            text: cmdText,
          },
        }),
      });

      const data = await res.json();

      if (data.sentMessages && data.sentMessages.length > 0) {
        for (const sent of data.sentMessages) {
          const botMsg: ChatMessage = {
            id: `bot_${sent.message_id}_${Date.now()}`,
            sender: 'bot',
            text: sent.text,
            inlineKeyboard: sent.reply_markup?.inline_keyboard,
            replyKeyboard: sent.reply_markup?.keyboard,
            timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, botMsg]);

          if (sent.reply_markup?.keyboard) {
            setActiveReplyKeyboard(sent.reply_markup.keyboard);
          }
        }
      }

      if (data.copiedMessages && data.copiedMessages.length > 0) {
        for (const c of data.copiedMessages) {
          setChannelMessages((prev) => [
            {
              id: c.message_id,
              fromChatId: c.from_chat_id,
              caption: c.caption,
              timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev,
          ]);
        }
      }

      fetchDbState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSendSampleFile(type: string, name: string, size: number, ext: string) {
    const userMsg: ChatMessage = {
      id: `usr_file_${Date.now()}`,
      sender: 'user',
      mediaType: type,
      fileName: name,
      fileSize: size,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    const messagePayload: any = {
      message_id: Math.floor(Math.random() * 8000) + 100,
      from: { id: activeUser.id, first_name: activeUser.name, username: 'test_user' },
      chat: { id: activeUser.id },
      date: Math.floor(Date.now() / 1000),
    };

    if (type === 'document') {
      messagePayload.document = {
        file_id: `doc_${Math.random().toString(36).substring(2, 9)}`,
        file_unique_id: `udoc_${Math.random().toString(36).substring(2, 7)}`,
        file_name: name,
        file_size: size,
        mime_type: ext === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      };
    } else if (type === 'photo') {
      messagePayload.photo = [
        {
          file_id: `photo_${Math.random().toString(36).substring(2, 9)}`,
          file_unique_id: `uphoto_${Math.random().toString(36).substring(2, 7)}`,
          width: 1280,
          height: 720,
          file_size: size,
        },
      ];
    } else if (type === 'video') {
      messagePayload.video = {
        file_id: `vid_${Math.random().toString(36).substring(2, 9)}`,
        file_unique_id: `uvid_${Math.random().toString(36).substring(2, 7)}`,
        file_name: name,
        width: 1920,
        height: 1080,
        duration: 120,
        file_size: size,
        mime_type: 'video/mp4',
      };
    } else if (type === 'audio') {
      messagePayload.audio = {
        file_id: `aud_${Math.random().toString(36).substring(2, 9)}`,
        file_unique_id: `uaud_${Math.random().toString(36).substring(2, 7)}`,
        title: name.replace(`.${ext}`, ''),
        performer: 'پادکست علمی',
        duration: 360,
        file_size: size,
        mime_type: 'audio/mpeg',
      };
    }

    try {
      const res = await fetch('/api/simulate/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messagePayload }),
      });

      const data = await res.json();

      if (data.sentMessages) {
        for (const sent of data.sentMessages) {
          const botMsg: ChatMessage = {
            id: `bot_${sent.message_id}_${Date.now()}`,
            sender: 'bot',
            text: sent.text,
            inlineKeyboard: sent.reply_markup?.inline_keyboard,
            timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, botMsg]);
        }
      }

      fetchDbState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCallbackClick(cbData: string, messageIdStr: string) {
    setIsProcessing(true);

    try {
      const res = await fetch('/api/simulate/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callbackQuery: {
            id: `cbq_${Date.now()}`,
            from: { id: activeUser.id, first_name: activeUser.name, username: 'test_user' },
            message: { message_id: 9999, chat: { id: activeUser.id } },
            data: cbData,
          },
        }),
      });

      const data = await res.json();

      if (data.editedMessages && data.editedMessages.length > 0) {
        for (const ed of data.editedMessages) {
          setMessages((prev) => [
            ...prev,
            {
              id: `bot_edit_${Date.now()}`,
              sender: 'bot',
              text: ed.text,
              inlineKeyboard: ed.reply_markup?.inline_keyboard,
              timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }

      if (data.sentMessages && data.sentMessages.length > 0) {
        for (const sent of data.sentMessages) {
          setMessages((prev) => [
            ...prev,
            {
              id: `bot_sent_${Date.now()}`,
              sender: 'bot',
              text: sent.text,
              inlineKeyboard: sent.reply_markup?.inline_keyboard,
              timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }

      fetchDbState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRunTests() {
    setTestRunning(true);
    setTestOutput(null);
    try {
      const res = await fetch('/api/run-tests');
      const data = await res.json();
      setTestOutput(data.output || data.error);
      setTestPassed(data.passed);
    } catch (err: any) {
      setTestOutput(`Error: ${err.message}`);
      setTestPassed(false);
    } finally {
      setTestRunning(false);
    }
  }

  async function handleAnalyzeScience() {
    setScienceLoading(true);
    setScienceAnalysis(null);

    const samplesContent: Record<string, string> = {
      '4hhb_hemoglobin.pdb': `HEADER    OXYGEN TRANSPORT                        07-MAR-84   4HHB
TITLE     THE CRYSTAL STRUCTURE OF HUMAN DEOXYHAEMOGLOBIN AT 1.74 A RESOLUTION
COMPND    MOL_ID: 1; MOLECULE: HEMOGLOBIN (DEOXY) (ALPHA CHAIN); CHAIN: A, C;
COMPND   2 MOL_ID: 2; MOLECULE: HEMOGLOBIN (DEOXY) (BETA CHAIN); CHAIN: B, D;
SOURCE    MOL_ID: 1; ORGANISM_SCIENTIFIC: HOMO SAPIENS; ORGANISM_TAXID: 9606;
KEYWDS    OXYGEN TRANSPORT, HEME, ALLOSTERY, TETRAMER
EXPDTA    X-RAY DIFFRACTION
RESLTN    1.74 ANGSTROMS.`,
      '1tup_p53.pdb': `HEADER    DNA BINDING                             21-JUL-94   1TUP
TITLE     COMPLEX OF P53 TUMOR SUPPRESSOR CORE DOMAIN BOUND TO DNA
COMPND    MOL_ID: 1; MOLECULE: CELLULAR TUMOR ANTIGEN P53; CHAIN: A, B, C;
COMPND   2 MOL_ID: 2; MOLECULE: DNA (5'-D(*CP*GP*GP*GP*CP*AP*TP*GP*CP*CP*C)-3')
SOURCE    MOL_ID: 1; ORGANISM_SCIENTIFIC: HOMO SAPIENS; ORGANISM_COMMON: HUMAN;
KEYWDS    TUMOR SUPPRESSOR, TRANSCRIPTION REGULATION, ZINC-FINGER, ONCOGENESIS
EXPDTA    X-RAY DIFFRACTION
RESLTN    2.20 ANGSTROMS.`,
      'tp53_variant_cds.fasta': `>NM_000546.6 Homo sapiens tumor protein p53 (TP53), transcript variant 1, mRNA
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTTC
CTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGATGCTGTCCCCGGACGATATTGAACAATG
GTTCACTGAAGACCCAGGTCCAGATGAAGCTCCCAGAATGCCAGAGGCTGCTCCCCCCGTGGCCCCTGCACCAGCAGCT
CCTACACCGGCGGCCCCTGCACCAGCCCCCTCCTGGCCCCTGTCATCTTCTGTCCCTTCCCAGAAAACCTACCAGGGC`,
      'imatinib_gleevec.sdf': `PubChem Compound CID: 5291
  -OEChem-01202611002D
 41 45  0     0  0  0  0  0  0999 V2000
    5.6410    0.8000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    4.7750    0.3000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
M  END
> <PUBCHEM_IUPAC_NAME>
4-[(4-methylpiperazin-1-yl)methyl]-N-[4-methyl-3-[(4-pyridin-3-ylpyrimidin-2-yl)amino]phenyl]benzamide`,
      'cancer_genomics_pmid_34215678.pdf': `Biomedical Research Article (PMID: 34215678)
Title: Genomic Landscape of Metastatic Colorectal Cancer and Mechanisms of Resistance
Authors: Smith J, et al.
Journal: Nature Genetics 2024
Key findings: Identification of recurrent TP53 hotspot mutations, KRAS G12D alleles, and BRAF V600E alterations conferring targeted therapy resistance.`,
    };

    try {
      const res = await fetch('/api/science-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: scienceSelectedFile,
          fileContent: samplesContent[scienceSelectedFile] || scienceCustomQuery,
          query: scienceCustomQuery || 'Perform an in-depth scientific analysis of this research file',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScienceAnalysis(data.analysis);
        setScienceModelUsed(data.modelUsed);
      } else {
        setScienceAnalysis(`خطا در بازرسی علمی: ${data.error}`);
      }
    } catch (err: any) {
      setScienceAnalysis(`خطای شبکه: ${err.message}`);
    } finally {
      setScienceLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white">FileLink Bot</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Telegram Serverless Native
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                  <Atom className="w-3 h-3" /> Science Module
                </span>
              </div>
              <p className="text-xs text-slate-400">سامانه بومی اشتراک فایل بر روی ابر تلگرام با پایگاه‌داده SQLite داخلی</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bot className="w-4 h-4" />
              شبیه‌ساز زنده ربات
            </button>

            <button
              onClick={() => {
                setActiveTab('database');
                fetchDbState();
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'database'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Database className="w-4 h-4" />
              دیتابیس SQLite
              {dbData?.files?.length !== undefined && (
                <span className="text-xs bg-slate-800 px-1.5 py-0.2 rounded-full text-indigo-300">
                  {dbData.files.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('science')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'science'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Dna className="w-4 h-4" />
              بازرسی علمی AI
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'tests'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              تست‌ها و تضمین کیفیت
            </button>

            <button
              onClick={() => setActiveTab('deployment')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'deployment'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Server className="w-4 h-4" />
              استقرار کلاود
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        {/* TAB 1: LIVE BOT SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Chat Simulator (Telegram Client View) */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[750px]">
              {/* Telegram Header */}
              <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center font-bold text-white shadow">
                      FL
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm text-white">FileLink Bot (@FileLinkBot)</h2>
                    <p className="text-xs text-emerald-400">bot • سرورلس رسمی تلگرام</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (activeUser.id === 1001) {
                        setActiveUser({ id: 2002, name: 'سارا (گیرنده فایل)' });
                      } else {
                        setActiveUser({ id: 1001, name: 'سینا (فرستنده)' });
                      }
                    }}
                    className="text-xs bg-slate-700/70 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-600 transition flex items-center gap-1.5"
                    title="تغییر هویت کاربر فعال"
                  >
                    <span>هویت:</span>
                    <strong className="text-sky-300">{activeUser.name}</strong>
                  </button>
                  <button
                    onClick={resetDatabase}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="ریست دیتابیس و پاکسازی چت"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Message Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/60">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        m.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-800/90 border border-slate-700 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      {/* Attached Media Display */}
                      {m.mediaType && (
                        <div className="mb-3 bg-indigo-700/50 p-3 rounded-xl border border-indigo-400/20 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-white/10">
                            {m.mediaType === 'document' && <FileText className="w-5 h-5 text-white" />}
                            {m.mediaType === 'photo' && <ImageIcon className="w-5 h-5 text-white" />}
                            {m.mediaType === 'video' && <Video className="w-5 h-5 text-white" />}
                            {m.mediaType === 'audio' && <Music className="w-5 h-5 text-white" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{m.fileName}</p>
                            <p className="text-xs text-indigo-200">
                              {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : 'فایل ارسالی'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Text content with HTML rendering */}
                      {m.text && (
                        <div
                          className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: m.text }}
                        />
                      )}

                      {/* Inline Keyboard Buttons */}
                      {m.inlineKeyboard && m.inlineKeyboard.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1.5">
                          {m.inlineKeyboard.map((row, rIdx) => (
                            <div key={rIdx} className="flex flex-wrap gap-1.5">
                              {row.map((btn, bIdx) => (
                                <button
                                  key={bIdx}
                                  onClick={() => {
                                    if (btn.callback_data) {
                                      handleCallbackClick(btn.callback_data, m.id);
                                    } else if (btn.url) {
                                      // If deep link, simulate open
                                      const tokenMatch = btn.url.match(/start=(f_[a-zA-Z0-9_-]+)/);
                                      if (tokenMatch) {
                                        triggerBotCommand(`/start ${tokenMatch[1]}`);
                                      } else {
                                        window.open(btn.url, '_blank');
                                      }
                                    }
                                  }}
                                  className="flex-1 min-w-[120px] text-xs bg-slate-700 hover:bg-slate-600 text-sky-200 hover:text-white px-3 py-2 rounded-lg transition font-medium border border-slate-600/50 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                >
                                  {btn.text}
                                  {btn.url && <ExternalLink className="w-3 h-3 text-sky-400" />}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-1 text-[10px] text-slate-400 text-left font-mono">
                        {m.timestamp}
                      </div>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-400 text-xs px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      در حال پردازش پیام توسط ربات...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Telegram Persistent Reply Keyboard if available */}
              {activeReplyKeyboard && (
                <div className="bg-slate-900 border-t border-slate-800 p-2 grid grid-cols-2 gap-1.5">
                  {activeReplyKeyboard.flat().map((btn: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => triggerBotCommand(btn.text)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg border border-slate-700 transition font-medium text-center"
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="bg-slate-900 p-3 border-t border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!inputPrompt.trim()) return;
                    triggerBotCommand(inputPrompt.trim());
                    setInputPrompt('');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder="پیام یا کپشن خود را تایپ کنید (مثلاً /start یا یک عدد انقضا)..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !inputPrompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition shadow shadow-indigo-600/30"
                  >
                    <Send className="w-5 h-5 rtl:rotate-180" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Quick Action Controls & Private Storage Channel Monitor */}
            <div className="lg:col-span-4 space-y-5">
              {/* Sample Files Dispatcher */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <UploadCloudIcon className="w-4 h-4 text-indigo-400" />
                  ارسال سریع فایل نمونه به ربات
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  یکی از رسانه‌ها یا ساختارهای زیستی زیر را برای شبیه‌سازی ارسال کنید:
                </p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleSendSampleFile('document', 'cancer_genomics_pmid_34215678.pdf', 1572864, 'pdf')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-right transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-rose-400" />
                      <div>
                        <div className="font-medium text-slate-200">مقاله ژنتیک سرطان (PMID: 34215678)</div>
                        <div className="text-[10px] text-slate-400">PDF • 1.5 MB • تشخیص خودکار علمی</div>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>

                  <button
                    onClick={() => handleSendSampleFile('document', '4hhb_hemoglobin.pdb', 524288, 'pdb')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-right transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Atom className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="font-medium text-slate-200">ساختار ۳بعدی هموگلوبین (4HHB)</div>
                        <div className="text-[10px] text-slate-400">PDB • ساختار بیومولکولی</div>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>

                  <button
                    onClick={() => handleSendSampleFile('document', 'tp53_variant_cds.fasta', 122880, 'fasta')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-right transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Dna className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-medium text-slate-200">توالی ژنومیک انسان (TP53 FASTA)</div>
                        <div className="text-[10px] text-slate-400">FASTA • توالی نوکلئوتیدی/پروتئینی</div>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>

                  <button
                    onClick={() => handleSendSampleFile('document', 'imatinib_gleevec.sdf', 30720, 'sdf')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-right transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Atom className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-medium text-slate-200">ترکیب شیمیایی ایماتینیب (Gleevec)</div>
                        <div className="text-[10px] text-slate-400">SDF • ساختار شیمیایی مولکولی</div>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>

                  <button
                    onClick={() => handleSendSampleFile('photo', 'scientific_figure_poster.jpg', 840000, 'jpg')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-right transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div className="font-medium text-slate-200">تصویر پوستر علمی (Photo)</div>
                        <div className="text-[10px] text-slate-400">JPEG • 1280x720 • کیفیت بالا</div>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                  </button>
                </div>
              </div>

              {/* Private Storage Channel Monitor */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    کانال خصوصی آرشیو ربات
                  </h3>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    ID: -1001234567890
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  فایل‌ها به صورت زنده با متد <code className="text-sky-300">api.copyMessage</code> در این کانال نگهداری می‌شوند:
                </p>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {channelMessages.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      هنوز فایلی در کانال آرشیو ثبت نشده است. یک فایل آپلود کنید تا کپی آن ذخیره شود.
                    </div>
                  ) : (
                    channelMessages.map((cm) => (
                      <div
                        key={cm.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-mono text-emerald-400">#پیام کانال: {cm.id}</span>
                          <span className="text-[10px]">{cm.timestamp}</span>
                        </div>
                        <div className="text-slate-300 font-mono text-[11px]">منبع: کاربر {cm.fromChatId}</div>
                        {cm.caption && (
                          <div className="text-slate-400 bg-slate-900/80 p-1.5 rounded text-[11px]">
                            کپشن: {cm.caption}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SQLITE DATABASE INSPECTOR */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  بازرس پایگاه‌داده داخلی تلگرام سرورلس (SQLite)
                </h2>
                <p className="text-xs text-slate-400">
                  تمامی داده‌ها، نشست‌ها، توکن‌های اشتراک و لاگ‌ها مستقیماً در پایگاه‌داده SQLite پلتفرم ذخیره می‌شوند.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDbState}
                  disabled={dbLoading}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
                  به‌روزرسانی داده‌ها
                </button>
                <button
                  onClick={resetDatabase}
                  className="px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  پاکسازی دیتابیس
                </button>
              </div>
            </div>

            {/* Table Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
              {[
                { id: 'files', label: 'فایل‌ها (files)', count: dbData?.files?.length || 0 },
                { id: 'users', label: 'کاربران (users)', count: dbData?.users?.length || 0 },
                { id: 'uploadSessions', label: 'نشست‌های فعال (upload_sessions)', count: dbData?.uploadSessions?.length || 0 },
                { id: 'fileDeliveries', label: 'تحویل‌ها (file_deliveries)', count: dbData?.fileDeliveries?.length || 0 },
                { id: 'processedEvents', label: 'رویدادهای تکرارناپذیر (processed_events)', count: dbData?.processedEvents?.length || 0 },
                { id: 'appSettings', label: 'تنظیمات (app_settings)', count: dbData?.appSettings?.length || 0 },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveDbTable(t.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                    activeDbTable === t.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="bg-slate-950/60 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Data Viewer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                {(!dbData || !dbData[activeDbTable] || dbData[activeDbTable].length === 0) ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    هیچ رکوردی در جدول <code className="text-indigo-400 font-mono">{activeDbTable}</code> ثبت نشده است.
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        {Object.keys(dbData[activeDbTable][0]).map((col) => (
                          <th key={col} className="px-4 py-3 whitespace-nowrap font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dbData[activeDbTable].map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition">
                          {Object.entries(row).map(([k, v], cellIdx) => (
                            <td key={cellIdx} className="px-4 py-3 whitespace-nowrap text-slate-300 font-mono">
                              {k === 'share_token' && v ? (
                                <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                                  {String(v)}
                                  <button
                                    onClick={() => copyToClipboard(`https://t.me/FileLinkBot?start=${v}`)}
                                    className="p-1 hover:text-white"
                                    title="کپی لینک"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : k === 'status' ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                                    v === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : v === 'EXPIRED'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {String(v)}
                                </span>
                              ) : v === null || v === undefined ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : typeof v === 'object' ? (
                                JSON.stringify(v)
                              ) : (
                                String(v)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCIENCE & BIOINFORMATICS AI INSPECTOR */}
        {activeTab === 'science' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-800/50 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-lg">
                  <Atom className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">بازرسی علمی و تحلیل هوشمند فایل‌ها (Bioinformatics AI)</h2>
                  <p className="text-xs text-indigo-200">
                    موتور استدلال سطح بالا (Gemini Thinking Mode با مدل <code>gemini-4-argon</code> و <code>ThinkingLevel.HIGH</code>)
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mt-2">
                ربات FileLink می‌تواند ساختارهای ماکرومولکولی پروتئین (PDB)، توالی‌های ژنومیک (FASTA)، ترکیبات شیمیایی (PubChem SDF) و مقالات پزشکی (PubMed) را به صورت خودکار شناسایی کرده و زمینه‌های زیستی و بالینی آن را قبل از اشتراک‌گذاری تحلیل کند.
              </p>
            </div>

            {/* Quick Sample Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-white mb-3">یک فایل یا مأخذ علمی را انتخاب کنید:</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: '4hhb_hemoglobin.pdb', label: 'هموگلوبین انسان (4HHB PDB)', badge: 'RCSB PDB' },
                  { id: '1tup_p53.pdb', label: 'مهارکننده تومور p53 با DNA (1TUP)', badge: 'Protein-DNA' },
                  { id: 'tp53_variant_cds.fasta', label: 'توالی ژنومیک کدکننده p53', badge: 'FASTA / UniProt' },
                  { id: 'imatinib_gleevec.sdf', label: 'ترکیب دارویی ایماتینیب (SDF)', badge: 'PubChem CID 5291' },
                  { id: 'cancer_genomics_pmid_34215678.pdf', label: 'مقاله ژنتیک سرطان (PMID 34215678)', badge: 'PubMed Literature' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setScienceSelectedFile(item.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                      scienceSelectedFile === item.id
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] bg-slate-950/50 px-1.5 py-0.5 rounded font-mono text-purple-200">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Query Input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  پرسش تخصصی یا دستورالعمل تحلیل زیستی:
                </label>
                <input
                  type="text"
                  value={scienceCustomQuery}
                  onChange={(e) => setScienceCustomQuery(e.target.value)}
                  placeholder="مثال: بررسی سایت‌های کاتالیتیک و جهش‌های بیماری‌زای کلین‌وار مرتبط با این ساختار..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <button
                onClick={handleAnalyzeScience}
                disabled={scienceLoading}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                {scienceLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    در حال تحلیل عمیق علمی با مدل استدلال بالا (Thinking Mode)...
                  </>
                ) : (
                  <>
                    <Dna className="w-4 h-4" />
                    اجرای استدلال علمی و بازرسی مولکولی
                  </>
                )}
              </button>
            </div>

            {/* AI Analysis Result */}
            {scienceAnalysis && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    نتایج ارزیابی زیستی و بازرسی متادیتا
                  </div>
                  {scienceModelUsed && (
                    <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-mono">
                      مدل: {scienceModelUsed} • استدلال بالا
                    </span>
                  )}
                </div>

                <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
                  {scienceAnalysis}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TEST RUNNER & QUALITY GATES */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
              <div>
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  محیط اجرای آزمون‌های خودکار و تضمین کیفیت
                </h2>
                <p className="text-xs text-slate-400">
                  ۳۰ آزمون جامع واحد و یکپارچگی شامل آپلود، کپشن، انقضا، آرشیو، توکن‌های ۱۲۸ بیتی، همزمانی و امنیت.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={testRunning}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
              >
                {testRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    در حال اجرای آزمون‌ها (npm test)...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    اجرای کامل تست‌ها
                  </>
                )}
              </button>
            </div>

            {/* Test Results Terminal */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 font-mono text-xs shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-slate-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>خروجی ترمینال تست بومی نودجی‌اس (Node.js Test Runner)</span>
                </div>
                {testPassed !== null && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      testPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {testPassed ? '۳۰ از ۳۰ تست موفق (Passed)' : 'خطا در تست‌ها'}
                  </span>
                )}
              </div>

              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[500px]">
                {testOutput ||
                  `برای مشاهده نتایج آزمون‌های واقعی، دکمه «اجرای کامل تست‌ها» را در بالا کلیک کنید.
یا در ترمینال دستور زیر را اجرا فرمایید:
$ npm test`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: CLOUD DEPLOYMENT & CLI */}
        {activeTab === 'deployment' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                راهنمای استقرار نهایی روی Telegram Serverless
              </h2>
              <p className="text-sm text-slate-300 mb-6">
                این پروژه با CLI رسمی پلتفرم (<code>@tgcloud/cli</code>) هماهنگ است و برای دیپلوی کافیست مراحل زیر را طی کنید:
              </p>

              <div className="space-y-4">
                {[
                  {
                    step: '۱',
                    title: 'ورود به اکانت سرورلس تلگرام',
                    command: 'npx tgcloud login',
                    desc: 'در این مرحله CLI Access Token دریافت شده از BotFather را وارد کنید.',
                  },
                  {
                    step: '۲',
                    title: 'تنظیم متغیرهای کانال و مدیر در دیتابیس',
                    command: `npx tgcloud db query "INSERT INTO app_settings (key, value, updated_at) VALUES ('STORAGE_CHANNEL_ID', '-1001234567890', 1700000000) ON CONFLICT(key) DO UPDATE SET value=excluded.value;"`,
                    desc: 'شناسه کانال خصوصی آرشیو و شناسه کاربری عددی ادمین اصلی را مشخص کنید.',
                  },
                  {
                    step: '۳',
                    title: 'اجرای مایگریشن پایگاه‌داده اس‌کیوالایت',
                    command: 'npx tgcloud migrate',
                    desc: 'جداول هفت‌گانه پروژه بدون کلید خارجی سخت‌افزاری بر روی ابر ایجاد می‌شوند.',
                  },
                  {
                    step: '۴',
                    title: 'استقرار و انتشار کدها (Push)',
                    command: 'npx tgcloud push',
                    desc: 'کدهای ماژولار پوشه tgcloud مستقیماً به محیط ایزولیت کلاود ارسال خواهند شد.',
                  },
                  {
                    step: '۵',
                    title: 'مشاهده وضعیت و مانیتورینگ زنده',
                    command: 'npx tgcloud logs --follow',
                    desc: 'لاگ‌های ساختاریافته وب‌هوک و تراکنش‌ها را در لحظه مشاهده کنید.',
                  },
                ].map((s) => (
                  <div key={s.step} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400">گام {s.step}: {s.title}</span>
                      <button
                        onClick={() => copyToClipboard(s.command)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        کپی دستور
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">{s.desc}</p>
                    <div className="bg-slate-900 px-3 py-2 rounded-lg font-mono text-xs text-sky-300 overflow-x-auto">
                      $ {s.command}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Copied Toast */}
      {copiedLink && (
        <div className="fixed bottom-6 left-6 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <Check className="w-4 h-4" />
          <span>لینک در کلیپ‌بورد کپی شد: {copiedLink}</span>
        </div>
      )}
    </div>
  );
}

function UploadCloudIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}
