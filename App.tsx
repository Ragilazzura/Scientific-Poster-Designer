
import React, { useState, useCallback, useRef } from 'react';
import { startPosterChat, revisePosterData } from './services/geminiService';
import type { PosterData, PosterTheme, PosterSection } from './types';
import type { Chat } from '@google/genai';
import PosterDisplay from './components/PosterDisplay';
import Loader from './components/Loader';
import ThemeEditor from './components/ThemeEditor';
import { SparklesIcon, UploadIcon, InfoIcon, WandIcon, RestartIcon, DownloadIcon, PaletteIcon, ClipboardCheckIcon, PencilIcon, UndoIcon, RedoIcon } from './components/IconComponents';
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

  // History Hook replaces the simple useState
  const history = useHistory<PosterData | null>(null);
  const posterData = history.state;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [showThemeEditor, setShowThemeEditor] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const posterRef = useRef<HTMLDivElement>(null);

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
            
            history.set(revisedData);
            setRevisionPrompt(''); // Clear input on success
        }
    } catch (e: any) {
        setError(`An unexpected error occurred: ${e.message}`);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [revisionPrompt, chatSession, leftLogoDataUrl, rightLogoDataUrl]);

  const handleStartOver = () => {
    setPrompt('A professional and modern design with a blue and gray color scheme. Emphasize the results section.');
    setFileContent('');
    setFileName('');
    setLeftLogoDataUrl('');
    setLeftLogoFileName('');
    setRightLogoDataUrl('');
    setRightLogoFileName('');
    history.clear(null);
    setIsLoading(false);
    setError(null);
    setChatSession(null);
    setRevisionPrompt('');
    setShowThemeEditor(false);
    setIsEditing(false);
  };

  const handleDownload = useCallback(() => {
    if (posterRef.current) {
        // Temporarily disable editing border before download
        const wasEditing = isEditing;
        if (wasEditing) setIsEditing(false);

        const element = posterRef.current;
        
        // Wait a tick for UI update (removing edit borders)
        setTimeout(() => {
            // TARGET: A3 Portrait at 300 DPI
            html2canvas(element, {
                scale: 3.1238, 
                useCORS: true, 
                backgroundColor: null,
                width: 1123, 
                height: 1588, // 4961 / 3.1238
                windowWidth: 1123,
                windowHeight: 1588,
                // Critical: Manipulate the CLONED DOM to force desktop layout regardless of current viewport
                onclone: (clonedDoc: Document) => {
                    const clonedRoot = clonedDoc.querySelector('[data-id="poster-root"]') as HTMLElement;
                    const clonedGrid = clonedDoc.querySelector('[data-id="poster-grid"]') as HTMLElement;
                    const desktopHeader = clonedDoc.querySelector('[data-id="header-desktop"]') as HTMLElement;
                    const mobileHeader = clonedDoc.querySelector('[data-id="header-mobile"]') as HTMLElement;

                    if (clonedRoot) {
                        clonedRoot.style.width = '1123px'; 
                        clonedRoot.style.minHeight = '1588px';
                        const contentHeight = clonedRoot.scrollHeight;
                        const requiredHeight = Math.max(1588, contentHeight);
                        clonedRoot.style.height = `${requiredHeight}px`;
                        clonedRoot.style.aspectRatio = 'unset'; 
                        clonedRoot.style.maxWidth = 'none';
                        clonedRoot.style.margin = '0';
                        clonedRoot.style.transform = 'none';
                        clonedRoot.style.overflow = 'visible';
                        clonedRoot.style.paddingBottom = '0px'; 
                        clonedRoot.style.boxShadow = 'none'; // Remove shadow for download
                    }

                    if (clonedGrid) {
                        clonedGrid.style.display = 'flex';
                        clonedGrid.style.flexDirection = 'row';
                        clonedGrid.style.flexWrap = 'nowrap';
                        clonedGrid.style.gap = '16px';
                    }
                    if (desktopHeader) {
                        desktopHeader.classList.remove('hidden');
                        desktopHeader.style.display = 'flex';
                    }
                    if (mobileHeader) {
                        mobileHeader.style.display = 'none';
                    }
                }
            }).then((canvas: HTMLCanvasElement) => {
                const link = document.createElement('a');
                link.download = 'scientific-poster-a3-portrait-300dpi.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                if (wasEditing) setIsEditing(true);
            }).catch((err: Error) => {
                console.error("Failed to download poster:", err);
                setError("Sorry, there was an issue downloading the poster image.");
                if (wasEditing) setIsEditing(true);
            });
        }, 100);
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
  const cardStyle = "bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-4 transition-all hover:shadow-md";
  const labelStyle = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2";
  const inputStyle = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const secondaryButtonStyle = "w-full py-2 px-3 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-800 transition shadow-sm flex items-center justify-center gap-2 active:scale-95";

  return (
    <div className="flex flex-col lg:flex-row bg-slate-50 font-sans min-h-screen lg:h-screen lg:overflow-hidden">
      
      {/* --- SIDEBAR / CONTROL PANEL --- */}
      <aside className="w-full lg:w-[380px] xl:w-[420px] bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col lg:h-full lg:overflow-y-auto z-20 shrink-0 relative">
        <div className="p-6 space-y-6">
            {/* App Header */}
            <header className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 leading-tight">Poster AI</h1>
                    <p className="text-xs text-slate-500 font-medium">Research Design Assistant</p>
                </div>
            </header>

            {posterData && chatSession ? (
              /* --- REVISION MODE --- */
              <div className="space-y-6 animate-fadeIn">
                 <div>
                    <h2 className="text-lg font-bold text-slate-800 mb-1">Refine Design</h2>
                    <p className="text-sm text-slate-500">Tweak your poster to perfection.</p>
                 </div>

                 {/* Undo/Redo Controls */}
                 <div className="flex gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <button onClick={history.undo} disabled={!history.canUndo} className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-sm transition ${!history.canUndo ? 'text-slate-300' : 'bg-white shadow-sm text-slate-700 hover:text-indigo-600'}`}>
                        <UndoIcon className="w-4 h-4 mr-1.5" /> Undo
                    </button>
                    <div className="w-px bg-slate-200 my-1"></div>
                    <button onClick={history.redo} disabled={!history.canRedo} className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-sm transition ${!history.canRedo ? 'text-slate-300' : 'bg-white shadow-sm text-slate-700 hover:text-indigo-600'}`}>
                        Redo <RedoIcon className="w-4 h-4 ml-1.5" />
                    </button>
                 </div>

                 {/* Manual Edit Toggle */}
                 <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center shadow-sm border ${isEditing ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                 >
                      <PencilIcon className={`w-4 h-4 mr-2 ${isEditing ? 'animate-pulse' : ''}`} />
                      {isEditing ? 'Exit Manual Edit Mode' : 'Enter Manual Edit Mode'}
                 </button>

                 <div className="space-y-4">
                    <div className={cardStyle}>
                        <label htmlFor="revision-prompt" className={labelStyle}>
                            AI Revision
                        </label>
                        <textarea
                            id="revision-prompt"
                            rows={3}
                            className={inputStyle}
                            value={revisionPrompt}
                            onChange={(e) => setRevisionPrompt(e.target.value)}
                            placeholder="e.g. Change the title color to navy blue, make the charts bigger..."
                        />
                         <button
                            onClick={handleRevisionSubmit}
                            disabled={isRevisionDisabled}
                            className={`mt-3 w-full py-2.5 rounded-lg text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center ${isRevisionDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]'}`}
                        >
                            {isLoading ? 'Processing...' : <><WandIcon className="w-4 h-4 mr-2" /> Apply Changes</>}
                        </button>
                    </div>

                    <div className={cardStyle}>
                        <label className={labelStyle}>Logos</label>
                         {/* Left Logo */}
                        <div className="flex items-center justify-between mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {leftLogoDataUrl ? (
                                    <img src={leftLogoDataUrl} className="w-8 h-8 object-contain bg-white rounded border border-slate-200 p-0.5" />
                                ) : (
                                    <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center text-slate-400"><UploadIcon className="w-4 h-4"/></div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{leftLogoFileName || "Left Logo"}</p>
                                    <label htmlFor="left-logo-edit" className="text-[10px] text-indigo-600 cursor-pointer hover:underline">
                                        {leftLogoDataUrl ? "Change" : "Upload"}
                                    </label>
                                    <input id="left-logo-edit" type="file" className="hidden" accept="image/*" onChange={handleLeftLogoChange} />
                                </div>
                             </div>
                             {leftLogoDataUrl && (
                                 <button onClick={handleRemoveLeftLogo} className="text-slate-400 hover:text-red-500 p-1.5"><span className="sr-only">Remove</span>×</button>
                             )}
                        </div>
                        {/* Right Logo */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {rightLogoDataUrl ? (
                                    <img src={rightLogoDataUrl} className="w-8 h-8 object-contain bg-white rounded border border-slate-200 p-0.5" />
                                ) : (
                                    <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center text-slate-400"><UploadIcon className="w-4 h-4"/></div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{rightLogoFileName || "Right Logo"}</p>
                                    <label htmlFor="right-logo-edit" className="text-[10px] text-indigo-600 cursor-pointer hover:underline">
                                        {rightLogoDataUrl ? "Change" : "Upload"}
                                    </label>
                                     <input id="right-logo-edit" type="file" className="hidden" accept="image/*" onChange={handleRightLogoChange} />
                                </div>
                             </div>
                              {rightLogoDataUrl && (
                                 <button onClick={handleRemoveRightLogo} className="text-slate-400 hover:text-red-500 p-1.5"><span className="sr-only">Remove</span>×</button>
                             )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setShowThemeEditor(!showThemeEditor)} className={secondaryButtonStyle}>
                            <PaletteIcon className="w-4 h-4 text-indigo-500" /> Colors
                        </button>
                         <button onClick={handleDownload} className={`${secondaryButtonStyle} !bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100`}>
                            <DownloadIcon className="w-4 h-4" /> Download
                        </button>
                    </div>

                    {showThemeEditor && (
                         <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-lg animate-fadeInUp">
                             <div className="flex justify-between items-center mb-3">
                                 <h3 className="font-bold text-slate-700 text-sm">Theme Editor</h3>
                                 <button onClick={() => setShowThemeEditor(false)} className="text-slate-400 hover:text-slate-600">×</button>
                             </div>
                             <ThemeEditor theme={posterData.theme} onThemeChange={handleThemeChange} />
                         </div>
                    )}
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                      <button onClick={handleStartOver} className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 py-2">
                          <RestartIcon className="w-3 h-3" /> Start Over
                      </button>
                 </div>
              </div>
            ) : (
              /* --- INITIAL GENERATION MODE --- */
              <div className="space-y-6">
                 {/* Steps visualizer? Maybe overkill. Let's keep it clean. */}
                 
                 {/* Step 1 */}
                 <div className={cardStyle}>
                    <label className={labelStyle}>1. Research Paper</label>
                    <label className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all group overflow-hidden ${fileName ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-indigo-400'}`}>
                        {fileName ? (
                             <div className="text-center p-4 z-10">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-2">
                                     <ClipboardCheckIcon className="w-6 h-6 text-emerald-500" />
                                </div>
                                <p className="text-sm font-semibold text-emerald-800 truncate max-w-[200px]">{fileName}</p>
                                <p className="text-xs text-emerald-600 mt-0.5">Click to replace</p>
                             </div>
                        ) : (
                             <div className="text-center p-4 z-10">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3 group-hover:scale-110 transition-transform text-indigo-500">
                                     <UploadIcon className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-medium text-slate-700">Drop PDF or DOCX here</p>
                                <p className="text-xs text-slate-400 mt-1">Max 10MB</p>
                             </div>
                        )}
                        <input type="file" className="hidden" accept=".txt,.md,.docx,.pdf" onChange={handleFileChange} />
                    </label>
                 </div>

                 {/* Step 2 */}
                 <div className={cardStyle}>
                     <label className={labelStyle}>2. Design Style</label>
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
                     <div className="flex gap-3">
                        <label className="flex-1 h-20 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition relative overflow-hidden">
                             {leftLogoDataUrl ? <img src={leftLogoDataUrl} className="h-full w-full object-contain p-2" /> : <span className="text-xs text-slate-400">Left Logo</span>}
                             <input type="file" className="hidden" accept="image/*" onChange={handleLeftLogoChange} />
                        </label>
                         <label className="flex-1 h-20 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition relative overflow-hidden">
                             {rightLogoDataUrl ? <img src={rightLogoDataUrl} className="h-full w-full object-contain p-2" /> : <span className="text-xs text-slate-400">Right Logo</span>}
                             <input type="file" className="hidden" accept="image/*" onChange={handleRightLogoChange} />
                        </label>
                     </div>
                 </div>

                 {error && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex gap-3 items-start animate-pulse">
                         <div className="text-red-500 mt-0.5">⚠️</div>
                         <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                    </div>
                 )}

                 <button
                    onClick={handleInitialSubmit}
                    disabled={isGenerateDisabled}
                    className={`w-full py-4 rounded-xl font-bold text-base shadow-xl shadow-indigo-200 transition-all transform flex items-center justify-center gap-2 ${isGenerateDisabled ? 'bg-slate-300 text-white cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:scale-[1.02] hover:shadow-indigo-300'}`}
                 >
                    {isLoading ? (
                         <div className="flex items-center gap-2">
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Designing...</span>
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
      <main className="flex-grow bg-slate-100 relative overflow-hidden flex flex-col">
        {/* Workspace Background Pattern */}
        <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none"></div>
        
        <div className="flex-grow overflow-auto p-4 lg:p-12 flex items-start justify-center relative z-10">
             {isLoading && !posterData ? (
                 <div className="flex flex-col items-center justify-center h-full animate-fadeIn">
                     <Loader message={loadingMessage} />
                 </div>
             ) : posterData ? (
                 <div className="animate-scaleIn origin-top w-full flex justify-center min-h-min pb-20">
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
                        onEditStart={history.snapshot}
                     />
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <div className="w-32 h-32 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-6">
                        <SparklesIcon className="w-12 h-12 text-slate-200" />
                     </div>
                     <h3 className="text-lg font-medium text-slate-500">Your Design Workspace</h3>
                     <p className="text-sm">Upload a paper to begin.</p>
                 </div>
             )}
        </div>
        
        {/* Helper Badge */}
        {posterData && (
             <div className="absolute bottom-6 right-6 bg-white/80 backdrop-blur border border-slate-200 px-4 py-2 rounded-full shadow-lg text-xs font-medium text-slate-500 flex items-center gap-2 z-20 pointer-events-none">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 A3 Portrait (300 DPI Ready)
             </div>
        )}
      </main>
    </div>
  );
};

export default App;
