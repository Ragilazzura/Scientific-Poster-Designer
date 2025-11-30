import React, { useState, useCallback, useRef, useEffect } from 'react';
import { startPosterChat, revisePosterData, generateAlternativePoster } from './services/geminiService';
import type { PosterData, PosterTheme, PosterSection } from './types';
import type { Chat } from '@google/genai';
import PosterDisplay from './components/PosterDisplay';
import Loader from './components/Loader';
import ThemeEditor from './components/ThemeEditor';
import { SparklesIcon, UploadIcon, InfoIcon, WandIcon, RestartIcon, DownloadIcon, PaletteIcon, ClipboardCheckIcon, PencilIcon, UndoIcon, RedoIcon, ZoomInIcon, ZoomOutIcon, LayersIcon, StarIcon } from './components/IconComponents';
import { useHistory } from './hooks/useHistory';

// Declare global variables for CDN libraries
declare var mammoth: any;
declare var pdfjsLib: any;
declare var html2canvas: any;

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('A professional and modern design with a blue and gray color scheme. Emphasize the results section.');
  const [revisionPrompt, setRevisionPrompt] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] =useState<string>('');
  
  // Left Logo State
  const [leftLogoDataUrl, setLeftLogoDataUrl] = useState<string>('');
  const [leftLogoFileName, setLeftLogoFileName] = useState<string>('');
  
  // Right Logo State
  const [rightLogoDataUrl, setRightLogoDataUrl] = useState<string>('');
  const [rightLogoFileName, setRightLogoFileName] = useState<string>('');

  // Version Control State
  const [versions, setVersions] = useState<PosterData[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);

  // History Hook replaces the simple useState
  const history = useHistory<PosterData | null>(null);
  const posterData = history.state;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false); // NEW: Track download state
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [showThemeEditor, setShowThemeEditor] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // Zoom State
  const [zoom, setZoom] = useState<number>(0.5);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Auto-fit Zoom when poster data loads
  useEffect(() => {
    if (posterData && workspaceRef.current) {
        const { clientWidth } = workspaceRef.current;
        const PADDING = 80;
        const posterWidth = 1753; // Updated to match new CSS width
        const availableWidth = clientWidth - PADDING;
        const scale = Math.min(1, availableWidth / posterWidth);
        setZoom(scale < 0.2 ? 0.2 : scale); // Min zoom safety
    }
  }, [posterData]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.2));


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName('Processing...');
    setError(null);
    setFileContent('');

    try {
        const extension = file.name.split('.').pop()?.toLowerCase();
        let text = '';
        const reader = new FileReader();

        if (extension === 'txt' || extension === 'md') {
            text = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = (e) => reject(new Error('Failed to read text file.'));
                reader.readAsText(file);
            });
        } else if (extension === 'docx') {
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
                reader.onerror = (e) => reject(new Error('Failed to read docx file.'));
                reader.readAsArrayBuffer(file);
            });
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
        } else if (extension === 'pdf') {
            if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
            }
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
                reader.onerror = (e) => reject(new Error('Failed to read pdf file.'));
                reader.readAsArrayBuffer(file);
            });
            const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // Defensive check: Ensure items exists before mapping
                if (textContent && Array.isArray(textContent.items)) {
                    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
                }
            }
            text = fullText;
        } else {
            throw new Error('Unsupported file type. Please upload a .txt, .md, .docx, or .pdf file.');
        }

        if (!text.trim()) {
            throw new Error('The file appears to be empty or could not be read.');
        }

        setFileContent(text);
        setFileName(file.name);
    } catch (err: any) {
        console.error("File processing error:", err);
        setError(err.message || 'Failed to parse the file. Please try a different format.');
        setFileName('');
        setFileContent('');
    }
  };

  const handleLeftLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLeftLogoFileName('Processing...');
    const reader = new FileReader();
    reader.onload = (e) => {
        const newLogoUrl = e.target?.result as string;
        setLeftLogoDataUrl(newLogoUrl);
        setLeftLogoFileName(file.name);
        if (posterData) {
            // Logo change is a distinct action, push to history
            history.set({ ...posterData, leftLogoUrl: newLogoUrl });
        }
    };
    reader.onerror = () => {
        setError('Failed to read left logo file.');
        setLeftLogoFileName('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLeftLogo = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setLeftLogoDataUrl('');
      setLeftLogoFileName('');
      if (posterData) {
          history.set({ ...posterData, leftLogoUrl: undefined });
      }
  };

  const handleRightLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRightLogoFileName('Processing...');
    const reader = new FileReader();
    reader.onload = (e) => {
        const newLogoUrl = e.target?.result as string;
        setRightLogoDataUrl(newLogoUrl);
        setRightLogoFileName(file.name);
        if (posterData) {
            history.set({ ...posterData, rightLogoUrl: newLogoUrl });
        }
    };
    reader.onerror = () => {
        setError('Failed to read right logo file.');
        setRightLogoFileName('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveRightLogo = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRightLogoDataUrl('');
      setRightLogoFileName('');
      if (posterData) {
          history.set({ ...posterData, rightLogoUrl: undefined });
      }
  };

  const handleInitialSubmit = useCallback(async () => {
    if (!prompt || !fileContent) {
      setError('Please provide a design prompt and upload a content file.');
      return;
    }
    setError(null);
    history.clear(null); // Clear history on new generation
    setVersions([]);
    setCurrentVersionIndex(0);
    setChatSession(null);
    setIsLoading(true);
    setShowThemeEditor(false);
    setIsEditing(false);

    try {
      const result = await startPosterChat(prompt, fileContent, setLoadingMessage);
      if (result.error) {
        setError(result.error);
      } else {
        let finalPosterData = result.posterData as PosterData;
        // Override/Set AI logos with user uploaded logos if available
        if (rightLogoDataUrl) {
            finalPosterData = { ...finalPosterData, rightLogoUrl: rightLogoDataUrl };
        }
        if (leftLogoDataUrl) {
            finalPosterData = { ...finalPosterData, leftLogoUrl: leftLogoDataUrl };
        }
        setVersions([finalPosterData]);
        setCurrentVersionIndex(0);
        history.set(finalPosterData);
        setChatSession(result.chat as Chat);
      }
    } catch (e: any) {
      setError(`An unexpected error occurred: ${e.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [prompt, fileContent, leftLogoDataUrl, rightLogoDataUrl]);

  const handleRevisionSubmit = useCallback(async () => {
    if (!revisionPrompt || !chatSession) {
      setError('Please enter a revision request.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setLoadingMessage('Revising your poster...');
    try {
        const result = await revisePosterData(chatSession, revisionPrompt);
        if ('error' in result) {
            setError(result.error);
        } else {
            let revisedData = result as PosterData;
            // Preserve user-uploaded logos during revision
            if (rightLogoDataUrl) revisedData.rightLogoUrl = rightLogoDataUrl;
            if (leftLogoDataUrl) revisedData.leftLogoUrl = leftLogoDataUrl;
            
            // Save current state before updating
            const updatedVersions = [...versions];
            updatedVersions[currentVersionIndex] = revisedData;
            setVersions(updatedVersions);

            history.set(revisedData);
            setRevisionPrompt(''); // Clear input on success
        }
    } catch (e: any) {
        setError(`An unexpected error occurred: ${e.message}`);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [revisionPrompt, chatSession, leftLogoDataUrl, rightLogoDataUrl, versions, currentVersionIndex]);

  // Handle switching between Version tabs
  const handleSwitchVersion = (index: number) => {
      if (index === currentVersionIndex || !posterData) return;
      
      // Autosave current displayed data back to the array before switching
      const updatedVersions = [...versions];
      updatedVersions[currentVersionIndex] = posterData;
      setVersions(updatedVersions);
      
      // Switch
      setCurrentVersionIndex(index);
      history.clear(updatedVersions[index]);
  };

  // Handle generating a new variation
  const handleCreateVariation = async () => {
      if (!chatSession || !posterData) return;
      
      // Autosave current
      const updatedVersions = [...versions];
      updatedVersions[currentVersionIndex] = posterData;
      setVersions(updatedVersions);

      setIsLoading(true);
      setLoadingMessage("Designing a new alternative variation...");
      setError(null);

      try {
          const result = await generateAlternativePoster(chatSession);
          if ('error' in result) {
              setError(result.error);
          } else {
               let newData = result as PosterData;
               // Preserve uploaded logos
               if (rightLogoDataUrl) newData.rightLogoUrl = rightLogoDataUrl;
               if (leftLogoDataUrl) newData.leftLogoUrl = leftLogoDataUrl;

               const newVersions = [...updatedVersions, newData];
               setVersions(newVersions);
               setCurrentVersionIndex(newVersions.length - 1); // Switch to new one
               history.clear(newData);
          }
      } catch (e: any) {
          setError(e.message || "Failed to create variation.");
      } finally {
          setIsLoading(false);
          setLoadingMessage('');
      }
  };

  const handleStartOver = () => {
    setPrompt('A professional and modern design with a blue and gray color scheme. Emphasize the results section.');
    setFileContent('');
    setFileName('');
    setLeftLogoDataUrl('');
    setLeftLogoFileName('');
    setRightLogoDataUrl('');
    setRightLogoFileName('');
    history.clear(null);
    setVersions([]);
    setCurrentVersionIndex(0);
    setIsLoading(false);
    setError(null);
    setChatSession(null);
    setRevisionPrompt('');
    setShowThemeEditor(false);
    setIsEditing(false);
  };

  const handleDownload = useCallback(() => {
    if (posterRef.current) {
        const wasEditing = isEditing;
        if (wasEditing) setIsEditing(false);
        
        // 1. Trigger Re-render at 100% scale (no zoom)
        setIsDownloading(true);

        const element = posterRef.current;
        
        // 2. Wait for state update and layout paint
        setTimeout(() => {
            // Updated to scale 1 because the element itself is now 1753px wide (exact requested size)
            // No need to upscale if the CSS width matches the target output.
            
            html2canvas(element, {
                scale: 1, 
                useCORS: true, 
                backgroundColor: null,
                width: element.offsetWidth, // Explicit width from element (1753px)
                height: element.offsetHeight, // Explicit height
                windowWidth: element.offsetWidth + 100, // Virtual window size
                windowHeight: element.offsetHeight + 100,
            }).then((canvas: HTMLCanvasElement) => {
                const link = document.createElement('a');
                link.download = 'scientific-poster-1753x2480.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                // 3. Restore state
                setIsDownloading(false);
                if (wasEditing) setIsEditing(true);
            }).catch((err: Error) => {
                console.error("Failed to download poster:", err);
                setError("Sorry, there was an issue downloading the poster image.");
                setIsDownloading(false);
                if (wasEditing) setIsEditing(true);
            });
        }, 500); // 500ms delay to allow render cycle to finish at scale(1)
    }
  }, [isEditing]);
  
  const handleThemeChange = (newTheme: PosterTheme) => {
    if(posterData) {
      history.set({ ...posterData, theme: newTheme });
    }
  };

  // --- MANUAL EDITING HANDLERS ---
  const handleUpdateHeader = (field: keyof PosterData, value: any) => {
      if (!posterData) return;
      history.update({ ...posterData, [field]: value });
  };

  const handleUpdateSection = (index: number, field: string, value: any) => {
      if (!posterData) return;
      const newSections = [...posterData.sections];
      if (newSections[index]) {
          newSections[index] = { ...newSections[index], [field]: value };
          if (field === 'visual') {
             history.set({ ...posterData, sections: newSections });
          } else {
             history.update({ ...posterData, sections: newSections });
          }
      }
  };

  const handleUpdateContact = (field: string, value: string) => {
      if (!posterData) return;
      history.update({ 
          ...posterData, 
          contactInfo: { ...posterData.contactInfo, [field]: value } 
      });
  };

  const handleAddSection = (column: '1' | '2' | '3') => {
      if (!posterData) return;
      const newSection: PosterSection = {
          id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: "New Section",
          content: "Enter your content here...",
          column: column
      };
      history.set({ ...posterData, sections: [...posterData.sections, newSection] });
  };

  const handleDeleteSection = (originalIndex: number) => {
      if (!posterData) return;
      const newSections = [...posterData.sections];
      newSections.splice(originalIndex, 1);
      history.set({ ...posterData, sections: newSections });
  };

  const handleReorderSections = (newSections: PosterSection[]) => {
      if (!posterData) return;
      history.set({ ...posterData, sections: newSections });
  };

  const isGenerateDisabled = !prompt || !fileContent || isLoading;
  const isRevisionDisabled = !revisionPrompt || isLoading;

  // Component Reusable Styles
  const cardStyle = "bg-white rounded-2xl shadow-sm border border-slate-100 p-5 transition-all hover:shadow-md";
  const labelStyle = "block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3";
  const inputStyle = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const secondaryButtonStyle = "w-full py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition shadow-sm flex items-center justify-center gap-2 active:scale-95";

  return (
    <div className="flex flex-col lg:flex-row bg-slate-50 font-sans h-screen overflow-hidden">
      
      {/* --- SIDEBAR / CONTROL PANEL --- */}
      <aside className="w-full lg:w-[400px] xl:w-[440px] bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col h-full z-20 shrink-0 relative">
        <div className="p-6 pb-2 shrink-0">
             {/* App Header */}
            <header className="flex items-center gap-4 pb-6 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold text-slate-900 leading-none">Poster AI</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">Research Design Assistant</p>
                </div>
            </header>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-0 scroll-smooth">
            {posterData && chatSession ? (
              /* --- REVISION MODE --- */
              <div className="space-y-6 animate-fadeIn py-4">
                 
                 {/* VERSION CONTROL UI */}
                 <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <LayersIcon className="w-5 h-5 text-slate-400" />
                            Versions
                        </h2>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Auto-saving</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {versions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSwitchVersion(idx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${idx === currentVersionIndex ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                            >
                                Option {String.fromCharCode(65 + idx)}
                            </button>
                        ))}
                        <button
                            onClick={handleCreateVariation}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-transparent shadow-sm hover:shadow-md flex items-center gap-1 whitespace-nowrap transition transform active:scale-95"
                        >
                            <StarIcon className="w-3 h-3" /> New Variant
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic">
                        Don't like this look? Click "New Variant" to generate a different design approach while keeping your content.
                    </p>
                 </div>

                 <hr className="border-slate-100" />

                 {/* Undo/Redo Controls */}
                 <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button onClick={history.undo} disabled={!history.canUndo} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-semibold transition ${!history.canUndo ? 'text-slate-400 cursor-not-allowed' : 'bg-white shadow-sm text-slate-700 hover:text-indigo-600'}`}>
                        <UndoIcon className="w-3.5 h-3.5 mr-1.5" /> Undo
                    </button>
                    <button onClick={history.redo} disabled={!history.canRedo} className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-semibold transition ${!history.canRedo ? 'text-slate-400 cursor-not-allowed' : 'bg-white shadow-sm text-slate-700 hover:text-indigo-600'}`}>
                        Redo <RedoIcon className="w-3.5 h-3.5 ml-1.5" />
                    </button>
                 </div>

                 {/* Manual Edit Toggle */}
                 <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`w-full py-4 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center shadow-sm border-2 ${isEditing ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}
                 >
                      <PencilIcon className={`w-5 h-5 mr-3 ${isEditing ? 'animate-bounce' : ''}`} />
                      {isEditing ? 'Exit Manual Edit Mode' : 'Enter Manual Edit Mode'}
                 </button>

                 <div className="space-y-5">
                    <div className={cardStyle}>
                        <label htmlFor="revision-prompt" className={labelStyle}>
                            AI Assistant
                        </label>
                        <textarea
                            id="revision-prompt"
                            rows={3}
                            className={inputStyle}
                            value={revisionPrompt}
                            onChange={(e) => setRevisionPrompt(e.target.value)}
                            placeholder="Tell AI to change colors, restructure content, or summarize better..."
                        />
                         <button
                            onClick={handleRevisionSubmit}
                            disabled={isRevisionDisabled}
                            className={`mt-4 w-full py-3 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center ${isRevisionDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]'}`}
                        >
                            {isLoading ? 'Processing...' : <><WandIcon className="w-4 h-4 mr-2" /> Apply with AI</>}
                        </button>
                    </div>

                    <div className={cardStyle}>
                        <label className={labelStyle}>Institution Logos</label>
                         {/* Left Logo */}
                        <div className="flex items-center justify-between mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors group">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {leftLogoDataUrl ? (
                                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center">
                                        <img src={leftLogoDataUrl} className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 bg-white rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 group-hover:text-indigo-300 group-hover:border-indigo-300 transition-colors"><UploadIcon className="w-5 h-5"/></div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{leftLogoFileName || "Left Logo"}</p>
                                    <label htmlFor="left-logo-edit" className="text-[10px] font-bold text-indigo-600 cursor-pointer hover:underline uppercase tracking-wide">
                                        {leftLogoDataUrl ? "Replace" : "Upload"}
                                    </label>
                                    <input id="left-logo-edit" type="file" className="hidden" accept="image/*" onChange={handleLeftLogoChange} />
                                </div>
                             </div>
                             {leftLogoDataUrl && (
                                 <button onClick={handleRemoveLeftLogo} className="text-slate-300 hover:text-red-500 p-2"><span className="sr-only">Remove</span>×</button>
                             )}
                        </div>
                        {/* Right Logo */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors group">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {rightLogoDataUrl ? (
                                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center">
                                        <img src={rightLogoDataUrl} className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 bg-white rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 group-hover:text-indigo-300 group-hover:border-indigo-300 transition-colors"><UploadIcon className="w-5 h-5"/></div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate">{rightLogoFileName || "Right Logo"}</p>
                                    <label htmlFor="right-logo-edit" className="text-[10px] font-bold text-indigo-600 cursor-pointer hover:underline uppercase tracking-wide">
                                        {rightLogoDataUrl ? "Replace" : "Upload"}
                                    </label>
                                     <input id="right-logo-edit" type="file" className="hidden" accept="image/*" onChange={handleRightLogoChange} />
                                </div>
                             </div>
                              {rightLogoDataUrl && (
                                 <button onClick={handleRemoveRightLogo} className="text-slate-300 hover:text-red-500 p-2"><span className="sr-only">Remove</span>×</button>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => setShowThemeEditor(!showThemeEditor)} className={secondaryButtonStyle}>
                            <PaletteIcon className="w-4 h-4 text-indigo-500" /> Colors
                        </button>
                         <button onClick={handleDownload} className={`${secondaryButtonStyle} !bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100 hover:!border-emerald-300`}>
                            <DownloadIcon className="w-4 h-4" /> Export
                        </button>
                    </div>

                    {showThemeEditor && (
                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm lg:absolute lg:inset-auto lg:top-1/2 lg:left-full lg:ml-4 lg:-translate-y-1/2 p-4">
                             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-scaleIn w-full max-w-sm lg:w-80 relative">
                                 <div className="flex justify-between items-center mb-4">
                                     <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><PaletteIcon className="w-4 h-4"/> Theme Editor</h3>
                                     <button onClick={() => setShowThemeEditor(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
                                 </div>
                                 <ThemeEditor theme={posterData.theme} onThemeChange={handleThemeChange} />
                             </div>
                         </div>
                    )}
                 </div>

                 <div className="pt-6 border-t border-slate-100">
                      <button onClick={handleStartOver} className="w-full text-xs font-medium text-slate-400 hover:text-red-500 flex items-center justify-center gap-2 py-2 transition-colors">
                          <RestartIcon className="w-3.5 h-3.5" /> Start New Design
                      </button>
                 </div>
              </div>
            ) : (
              /* --- INITIAL GENERATION MODE --- */
              <div className="space-y-8 py-4">
                 
                 {/* Step 1 */}
                 <div className={cardStyle}>
                    <label className={labelStyle}>1. Research Paper</label>
                    <label className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all group overflow-hidden ${fileName ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-indigo-400'}`}>
                        {fileName ? (
                             <div className="text-center p-4 z-10 animate-fadeIn">
                                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mx-auto mb-3">
                                     <ClipboardCheckIcon className="w-7 h-7 text-emerald-500" />
                                </div>
                                <p className="text-sm font-bold text-emerald-800 truncate max-w-[200px]">{fileName}</p>
                                <p className="text-xs text-emerald-600 mt-1 font-medium">Click to replace</p>
                             </div>
                        ) : (
                             <div className="text-center p-4 z-10">
                                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3 group-hover:scale-110 transition-transform text-indigo-500">
                                     <UploadIcon className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-slate-700">Upload PDF / DOCX</p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">Max 10MB</p>
                             </div>
                        )}
                        <input type="file" className="hidden" accept=".txt,.md,.docx,.pdf" onChange={handleFileChange} />
                    </label>
                 </div>

                 {/* Step 2 */}
                 <div className={cardStyle}>
                     <label className={labelStyle}>2. Design Direction</label>
                     <textarea
                        rows={3}
                        className={inputStyle}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your desired look (e.g., minimalist, medical blue, dark mode tech...)"
                     />
                 </div>

                 {/* Step 3 */}
                 <div className={cardStyle}>
                     <label className={labelStyle}>3. Logos (Optional)</label>
                     <div className="flex gap-4">
                        <label className="flex-1 h-24 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition relative overflow-hidden group">
                             {leftLogoDataUrl ? <img src={leftLogoDataUrl} className="h-full w-full object-contain p-2" /> : <div className="flex flex-col items-center"><UploadIcon className="w-4 h-4 text-slate-300 mb-1 group-hover:text-indigo-400"/><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-indigo-500">Left</span></div>}
                             <input type="file" className="hidden" accept="image/*" onChange={handleLeftLogoChange} />
                        </label>
                         <label className="flex-1 h-24 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition relative overflow-hidden group">
                             {rightLogoDataUrl ? <img src={rightLogoDataUrl} className="h-full w-full object-contain p-2" /> : <div className="flex flex-col items-center"><UploadIcon className="w-4 h-4 text-slate-300 mb-1 group-hover:text-indigo-400"/><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-indigo-500">Right</span></div>}
                             <input type="file" className="hidden" accept="image/*" onChange={handleRightLogoChange} />
                        </label>
                     </div>
                 </div>

                 {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 items-start animate-pulse">
                         <div className="text-red-500 mt-0.5">⚠️</div>
                         <p className="text-xs font-medium text-red-700 leading-relaxed">{error}</p>
                    </div>
                 )}

                 <button
                    onClick={handleInitialSubmit}
                    disabled={isGenerateDisabled}
                    className={`w-full py-4 rounded-xl font-bold text-base shadow-xl shadow-indigo-200 transition-all transform flex items-center justify-center gap-2 ${isGenerateDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:scale-[1.02] hover:shadow-indigo-300'}`}
                 >
                    {isLoading ? (
                         <div className="flex items-center gap-2">
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Creating Design...</span>
                         </div>
                    ) : (
                        <>
                             <SparklesIcon className="w-5 h-5" /> Generate Poster
                        </>
                    )}
                 </button>
              </div>
            )}
        </div>
      </aside>

      {/* --- MAIN PREVIEW AREA (WORKSPACE) --- */}
      <main className="flex-grow bg-slate-50 relative overflow-hidden flex flex-col" ref={workspaceRef}>
        {/* Workspace Background Pattern */}
        <div className="absolute inset-0 bg-dot-pattern opacity-60 pointer-events-none"></div>
        
        {/* Zoom Controls */}
        {posterData && !isDownloading && (
             <div className="absolute bottom-6 right-6 z-40 flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-lg border border-slate-100">
                <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"><ZoomOutIcon className="w-5 h-5" /></button>
                <span className="text-xs font-bold font-mono text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"><ZoomInIcon className="w-5 h-5" /></button>
             </div>
        )}

        {/* Scrollable Container */}
        {/* CHANGED: Removed items-center, added p-0 with explicit top spacing in transform, changed flex layout to allow top-aligned scrolling */}
        <div className="flex-grow overflow-auto flex justify-center relative z-10 scrollbar-thin">
             {isLoading && !posterData ? (
                 <div className="flex flex-col items-center justify-center h-full animate-fadeIn w-full max-w-md">
                     <Loader message={loadingMessage} />
                 </div>
             ) : posterData ? (
                 /* CHANGED: transform origin-top instead of origin-center to prevent top cutoff when zoomed */
                 <div 
                    className="origin-top transition-transform duration-300 mb-20"
                    style={{ 
                        transform: isDownloading ? 'scale(1)' : `scale(${zoom})`, 
                        marginTop: isDownloading ? '0px' : '40px',
                        // Force center if downloading
                        marginLeft: isDownloading ? 'auto' : undefined,
                        marginRight: isDownloading ? 'auto' : undefined
                    }}
                 >
                     <PosterDisplay 
                        data={posterData} 
                        ref={posterRef} 
                        isEditing={isEditing}
                        onUpdateHeader={handleUpdateHeader}
                        onUpdateSection={handleUpdateSection}
                        onUpdateContact={handleUpdateContact}
                        onAddSection={handleAddSection}
                        onDeleteSection={handleDeleteSection}
                        onReorderSections={handleReorderSections}
                        onEditStart={() => history.snapshot()}
                     />
                 </div>
             ) : null}
        </div>
      </main>
    </div>
  );
};

export default App;