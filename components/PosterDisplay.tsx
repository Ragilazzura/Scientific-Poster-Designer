import React, { forwardRef, useState, useEffect, useRef } from 'react';
import type { PosterData, VisualData, PosterSection, SectionDesign } from '../types';
import { 
    AcademicCapIcon, BeakerIcon, ChartBarIcon, ClipboardCheckIcon, 
    MailIcon, PhoneIcon, LocationMarkerIcon, GlobeAltIcon, TableIcon, 
    UploadIcon, TrashIcon, PlusIcon, CogIcon, iconMap, PencilIcon, DragHandleIcon, InfoIcon
} from './IconComponents';

interface PosterDisplayProps {
  data: PosterData;
  isEditing?: boolean;
  onUpdateHeader?: (field: keyof PosterData, value: any) => void;
  onUpdateSection?: (index: number, field: string, value: any) => void;
  onUpdateContact?: (field: string, value: string) => void;
  onAddSection?: (column: '1' | '2' | '3') => void;
  onDeleteSection?: (index: number) => void;
  onReorderSections?: (newSections: PosterSection[]) => void;
  onEditStart?: () => void;
}

// Helper component to parse and render simple inline markdown.
const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const safeText = String(text);
  
  // Basic paragraph splitting
  const paragraphs = safeText.split(/\n\n+/);

  return (
    <div className="space-y-3">
        {paragraphs.map((paragraph, idx) => {
            // Check for list items
            if (paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ')) {
                 const listItems = paragraph.split(/\n/).filter(l => l.trim().length > 0);
                 return (
                     <ul key={idx} className="list-disc ml-5 space-y-1">
                         {listItems.map((item, i) => {
                             const content = item.replace(/^[-*]\s+/, '');
                             return <li key={i}>{parseInlineFormatting(content)}</li>
                         })}
                     </ul>
                 )
            }
            // Numbered list detection
             if (/^\d+\.\s/.test(paragraph.trim())) {
                 const listItems = paragraph.split(/\n/).filter(l => l.trim().length > 0);
                 return (
                     <ol key={idx} className="list-decimal ml-5 space-y-1">
                         {listItems.map((item, i) => {
                             const content = item.replace(/^\d+\.\s+/, '');
                             return <li key={i}>{parseInlineFormatting(content)}</li>
                         })}
                     </ol>
                 )
            }

            return <p key={idx}>{parseInlineFormatting(paragraph)}</p>
        })}
    </div>
  );
};

const parseInlineFormatting = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|_.*?_|\*.*?\*)/g);
  return (
    <>
      {parts.filter(Boolean).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
};

const defaultSectionIconMap: { [key: string]: string } = {
    'introduction': 'academic',
    'background': 'academic',
    'method': 'beaker',
    'methods': 'beaker',
    'methodology': 'beaker',
    'analysis': 'chart',
    'results': 'chart',
    'discussion': 'chart',
    'conclusion': 'clipboard',
    'conclusions': 'clipboard',
    'references': 'clipboard'
};

// --- VISUAL COMPONENTS (DENSE A3 SCALE) ---

const DonutChart: React.FC<{ items: { label: string; value: number; color: string }[]; caption?: string }> = ({ items, caption }) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    const total = items.reduce((acc, item) => acc + (Number(item?.value) || 0), 0);
    if (total === 0) return null;

    let currentAngle = 0;

    return (
        <div className="flex flex-col items-center justify-center p-1 w-full pointer-events-none">
            <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {items.map((item, index) => {
                        const val = Number(item?.value) || 0;
                        const sliceAngle = (val / total) * 360;
                        const x1 = 50 + 40 * Math.cos((Math.PI * currentAngle) / 180);
                        const y1 = 50 + 40 * Math.sin((Math.PI * currentAngle) / 180);
                        const x2 = 50 + 40 * Math.cos((Math.PI * (currentAngle + sliceAngle)) / 180);
                        const y2 = 50 + 40 * Math.sin((Math.PI * (currentAngle + sliceAngle)) / 180);
                        
                        const largeArc = sliceAngle > 180 ? 1 : 0;
                        const color = item?.color || '#ccc';

                        if (sliceAngle >= 359.9) {
                            return <circle key={index} cx="50" cy="50" r="40" fill={color} stroke="white" strokeWidth="2" />;
                        }
                        
                        const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                        
                        currentAngle += sliceAngle;
                        return <path key={index} d={pathData} fill={color} stroke="white" strokeWidth="2" />;
                    })}
                </svg>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center text-[9px] font-medium leading-tight text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: item.color }}></span>
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
             {caption && <p className="text-[9px] text-slate-500 italic mt-0.5 text-center">{caption}</p>}
        </div>
    );
};

const LineChart: React.FC<{ labels: string[]; datasets: { label: string; data: number[]; color: string }[]; caption?: string }> = ({ labels, datasets, caption }) => {
     if (!datasets || !Array.isArray(datasets) || datasets.length === 0) return null;
     if (!labels || !Array.isArray(labels)) return null;

     const allValues = datasets.flatMap(d => d.data || []);
     const max = Math.max(...allValues, 10);
     const min = Math.min(...allValues, 0);
     const range = max - min;

     return (
        <div className="w-full p-1 pointer-events-none">
            <div className="relative h-24 w-full border-l border-b border-slate-300">
                <svg className="w-full h-full" preserveAspectRatio="none">
                    {datasets.map((ds, i) => {
                        if(!ds.data) return null;
                        const points = ds.data.map((val, idx) => {
                             const x = (idx / (labels.length - 1)) * 100;
                             const y = 100 - ((val - min) / range) * 100;
                             return `${x},${y}`;
                        }).join(' ');
                        return <polyline key={i} points={points} fill="none" stroke={ds.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
                    })}
                </svg>
            </div>
             <div className="flex justify-between mt-0.5 text-[8px] text-slate-600 px-1 font-medium">
                {labels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                {datasets.map((ds, i) => (
                    <div key={i} className="flex items-center text-[9px] font-medium text-slate-700">
                        <span className="w-2 h-0.5 mr-1" style={{ backgroundColor: ds.color }}></span>
                        <span>{ds.label}</span>
                    </div>
                ))}
            </div>
            {caption && <p className="text-[9px] text-slate-500 italic mt-0.5 text-center">{caption}</p>}
        </div>
     );
};

const BarChart: React.FC<{ labels: string[]; datasets: { label: string; data: number[]; color: string }[]; caption?: string }> = ({ labels, datasets, caption }) => {
    if (!datasets || !Array.isArray(datasets) || datasets.length === 0) return null;
    if (!labels || !Array.isArray(labels)) return null;

    const allValues = datasets.flatMap(d => d.data || []);
    const max = Math.max(...allValues, 10) * 1.1;

    return (
       <div className="w-full p-1 pointer-events-none">
           <div className="relative h-24 w-full border-l border-b border-slate-300 flex items-end justify-around px-1">
               {labels.map((label, labelIndex) => (
                   <div key={labelIndex} className="flex flex-col items-center justify-end h-full w-full mx-0.5">
                       <div className="flex items-end justify-center w-full gap-0.5 h-full">
                           {datasets.map((ds, dsIndex) => {
                               const val = ds.data?.[labelIndex] || 0;
                               const height = (val / max) * 100;
                               return (
                                   <div 
                                       key={dsIndex} 
                                       className="w-full max-w-[16px] rounded-t transition-all hover:opacity-80 relative group"
                                       style={{ height: `${height}%`, backgroundColor: ds.color }}
                                   >
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               ))}
           </div>
            <div className="flex justify-around mt-0.5 text-[8px] text-slate-600 w-full text-center font-medium">
               {labels.map((l, i) => <span key={i} className="w-full truncate px-0.5">{l}</span>)}
           </div>
           {datasets.length > 1 && (
               <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                   {datasets.map((ds, i) => (
                       <div key={i} className="flex items-center text-[9px] font-medium text-slate-700">
                           <span className="w-1.5 h-1.5 mr-1" style={{ backgroundColor: ds.color }}></span>
                           <span>{ds.label}</span>
                       </div>
                   ))}
               </div>
           )}
           {caption && <p className="text-[9px] text-slate-500 italic mt-0.5 text-center">{caption}</p>}
       </div>
    );
};

const TableRenderer: React.FC<{ headers: string[]; rows: string[][]; caption?: string }> = ({ headers, rows, caption }) => {
    if(!headers || !rows) return null;
    return (
      <div className="w-full p-1 overflow-x-auto pointer-events-none">
        <table className="min-w-full text-[9px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {headers.map((h, i) => (
                <th key={i} className="py-1 px-1.5 font-bold text-slate-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                {row?.map((cell, j) => (
                  <td key={j} className="py-1 px-1.5 text-slate-700 border-r border-slate-100 last:border-0 align-top">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {caption && <p className="text-[9px] text-slate-500 italic mt-0.5 text-center">{caption}</p>}
      </div>
    );
};

// --- CHART EDITOR MODAL (SIDE-BY-SIDE PREVIEW) ---
const ChartEditModal: React.FC<{ visual: VisualData; onSave: (v: VisualData) => void; onClose: () => void }> = ({ visual, onSave, onClose }) => {
    const [edited, setEdited] = useState<VisualData>(JSON.parse(JSON.stringify(visual)));

    // Helper to render live preview
    const renderPreview = () => {
        // We clone the object slightly to ensure the Chart components re-render cleanly
        switch (edited.type) {
            case 'donutChart': 
                return <DonutChart items={edited.items || []} caption={edited.caption} />;
            case 'lineChart': 
                return <LineChart labels={edited.labels || []} datasets={edited.datasets || []} caption={edited.caption} />;
            case 'barChart': 
                return <BarChart labels={edited.labels || []} datasets={edited.datasets || []} caption={edited.caption} />;
            default: 
                return <p className="text-sm text-slate-400 text-center py-10">Preview not available for this type</p>;
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
               {/* Header */}
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       <PencilIcon className="w-4 h-4 text-indigo-500" />
                       Edit Visual
                   </h3>
                   <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none">&times;</button>
               </div>
               
               {/* Body (Split View) */}
               <div className="flex flex-col md:flex-row h-full overflow-hidden">
                   
                   {/* Left: Controls */}
                   <div className="w-full md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 bg-white">
                      <div className="space-y-6">
                        {/* Caption */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Caption</label>
                            <input 
                                className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                                value={edited.caption || ''}
                                onChange={e => setEdited({...edited, caption: e.target.value})}
                                placeholder="Chart caption..."
                            />
                        </div>

                        {/* Donut Specific */}
                        {edited.type === 'donutChart' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Segments</label>
                                {edited.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 animate-fadeIn">
                                        <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm" value={item.color} onChange={e => {
                                            const newItems = [...edited.items];
                                            newItems[idx].color = e.target.value;
                                            setEdited({...edited, items: newItems});
                                        }} />
                                        <input className="flex-1 text-sm border border-slate-200 rounded-lg p-2 focus:border-indigo-300 outline-none" placeholder="Label" value={item.label} onChange={e => {
                                            const newItems = [...edited.items];
                                            newItems[idx].label = e.target.value;
                                            setEdited({...edited, items: newItems});
                                        }} />
                                        <input type="number" className="w-20 text-sm border border-slate-200 rounded-lg p-2 focus:border-indigo-300 outline-none" placeholder="Val" value={item.value} onChange={e => {
                                            const newItems = [...edited.items];
                                            newItems[idx].value = Number(e.target.value);
                                            setEdited({...edited, items: newItems});
                                        }} />
                                        <button onClick={() => {
                                            setEdited({...edited, items: edited.items.filter((_, i) => i !== idx)});
                                        }} className="text-slate-400 hover:text-red-500 p-1 transition"><TrashIcon className="w-4 h-4"/></button>
                                    </div>
                                ))}
                                <button onClick={() => setEdited({...edited, items: [...edited.items, { label: 'New', value: 10, color: '#000000' }]})} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">+ Add Segment</button>
                            </div>
                        )}

                        {/* Bar/Line Specific */}
                        {(edited.type === 'barChart' || edited.type === 'lineChart') && (
                            <div className="space-y-4">
                                {/* X-Axis */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">X-Axis Labels (Comma separated)</label>
                                    <input 
                                        className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono" 
                                        value={edited.labels.join(', ')}
                                        onChange={e => setEdited({...edited, labels: e.target.value.split(',').map(s => s.trim())})}
                                        placeholder="Jan, Feb, Mar..."
                                    />
                                </div>
                                
                                {/* Datasets */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Datasets</label>
                                    {edited.datasets.map((ds, idx) => (
                                        <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-slate-50 space-y-2 animate-fadeIn">
                                            <div className="flex items-center gap-2">
                                                <input type="color" className="w-6 h-6 rounded cursor-pointer border-0 p-0 shadow-sm" value={ds.color} onChange={e => {
                                                    const newDs = [...edited.datasets];
                                                    newDs[idx].color = e.target.value;
                                                    setEdited({...edited, datasets: newDs});
                                                }} />
                                                <input className="flex-1 text-sm border border-slate-200 rounded bg-white px-2 py-1 focus:border-indigo-300 outline-none" placeholder="Dataset Name" value={ds.label} onChange={e => {
                                                    const newDs = [...edited.datasets];
                                                    newDs[idx].label = e.target.value;
                                                    setEdited({...edited, datasets: newDs});
                                                }} />
                                                <button onClick={() => {
                                                    setEdited({...edited, datasets: edited.datasets.filter((_, i) => i !== idx)});
                                                }} className="text-slate-400 hover:text-red-500 transition"><TrashIcon className="w-4 h-4"/></button>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Data Points (Comma separated)</label>
                                                <input 
                                                    className="w-full text-sm border border-slate-200 rounded bg-white px-2 py-1 font-mono focus:border-indigo-300 outline-none" 
                                                    placeholder="10, 20, 30..."
                                                    value={ds.data.join(', ')}
                                                    onChange={e => {
                                                        const newDs = [...edited.datasets];
                                                        newDs[idx].data = e.target.value.split(',').map(s => Number(s.trim()) || 0);
                                                        setEdited({...edited, datasets: newDs});
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setEdited({...edited, datasets: [...edited.datasets, { label: 'New Set', data: [], color: '#000000' }]})} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">+ Add Dataset</button>
                                </div>
                            </div>
                        )}
                      </div>
                   </div>

                   {/* Right: Preview */}
                   <div className="w-full md:w-1/2 p-6 bg-slate-50/50 flex flex-col overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Preview</h4>
                            <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Auto-updates</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full max-w-sm mx-auto">
                                 {renderPreview()}
                             </div>
                        </div>
                   </div>
               </div>

               {/* Footer */}
               <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 z-10 relative">
                   <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Cancel</button>
                   <button onClick={() => onSave(edited)} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm hover:shadow">Save Changes</button>
               </div>
            </div>
        </div>
    );
}

// --- LIGHTBOX MODAL ---
const Lightbox: React.FC<{ visual: VisualData; onClose: () => void }> = ({ visual, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl relative animate-scaleIn" onClick={e => e.stopPropagation()}>
                 <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 z-10 transition">
                    <TrashIcon className="w-6 h-6 rotate-45" /> 
                 </button>
                 
                 <div className="flex flex-col items-center">
                    {visual.type === 'image' && (
                        <img src={visual.url} alt={visual.caption} className="max-w-full h-auto max-h-[70vh] object-contain rounded-lg shadow-sm" />
                    )}
                    {visual.type === 'donutChart' && 'items' in visual && <DonutChart items={visual.items} />}
                    {visual.type === 'lineChart' && 'labels' in visual && <LineChart labels={visual.labels} datasets={visual.datasets} />}
                    {visual.type === 'barChart' && 'labels' in visual && <BarChart labels={visual.labels} datasets={visual.datasets} />}
                    {visual.type === 'table' && 'headers' in visual && <TableRenderer headers={visual.headers} rows={visual.rows} />}
                    
                    {visual.caption && (
                        <p className="mt-6 text-lg text-slate-600 font-medium text-center max-w-2xl">{visual.caption}</p>
                    )}
                 </div>
            </div>
        </div>
    );
};

// --- DROP PLACEHOLDER COMPONENT (SMART GAP) ---
const DropPlaceholder: React.FC = () => (
    <div className="h-24 w-full my-3 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/50 animate-pulse flex items-center justify-center text-indigo-400 font-bold text-xs uppercase tracking-wider transition-all duration-300">
        Drop Here
    </div>
);

// --- WARNINGS BANNER ---
const WarningsBanner: React.FC<{ warnings?: string[] }> = ({ warnings }) => {
    const [isVisible, setIsVisible] = useState(true);

    if (!warnings || warnings.length === 0 || !isVisible) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-fadeInDown">
            <div className="bg-amber-50 border border-amber-200 shadow-xl rounded-xl p-4 flex items-start gap-3">
                <InfoIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-amber-800 mb-1">Content Analysis</h4>
                    <ul className="list-disc ml-4 space-y-1">
                        {warnings.map((w, i) => (
                            <li key={i} className="text-xs text-amber-700">{w}</li>
                        ))}
                    </ul>
                </div>
                <button onClick={() => setIsVisible(false)} className="text-amber-400 hover:text-amber-700">
                    <span className="sr-only">Close</span>&times;
                </button>
            </div>
        </div>
    );
};


// --- SECTION CARD COMPONENT ---

const SectionCard: React.FC<{
    section: PosterSection;
    index: number;
    theme: PosterData['theme'];
    isEditing: boolean;
    onUpdate: (index: number, field: string, value: any) => void;
    onDelete: (index: number) => void;
    onEditStart: () => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    isDragged: boolean;
    dropIndicator: 'top' | 'bottom' | null;
}> = ({ section, index, theme, isEditing, onUpdate, onDelete, onEditStart, onDragStart, onDragOver, onDrop, onDragEnd, isDragged, dropIndicator }) => {
    
    const iconKey = section.design?.icon || Object.keys(defaultSectionIconMap).find(k => section.title.toLowerCase().includes(k)) || 'clipboard';
    const Icon = iconMap[defaultSectionIconMap[iconKey] || iconKey] || iconMap['clipboard'];
    const [showSettings, setShowSettings] = useState(false);
    const [lightboxVisual, setLightboxVisual] = useState<VisualData | null>(null);
    const [editingVisualIndex, setEditingVisualIndex] = useState<number | null>(null);

    // --- Autosave Logic for Content ---
    const [localContent, setLocalContent] = useState(section.content);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalContent(section.content);
    }, [section.content]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalContent(val);
        setSaveStatus('unsaved');
        
        if (timerRef.current) clearTimeout(timerRef.current);
        
        timerRef.current = setTimeout(() => {
            setSaveStatus('saving');
            onUpdate(index, 'content', val);
            setTimeout(() => setSaveStatus('saved'), 500);
        }, 3000);
    };

    const handleBlur = () => {
        if (saveStatus === 'unsaved') {
            if (timerRef.current) clearTimeout(timerRef.current);
            setSaveStatus('saving');
            onUpdate(index, 'content', localContent);
            setTimeout(() => setSaveStatus('saved'), 500);
        }
    };

    const headerBg = section.design?.customColor || theme.headingColor;
    const bodyBg = section.design?.customBackgroundColor || theme.sectionBackgroundColor;
    const variant = section.design?.variant || 'default';

    const getHeaderStyle = () => {
        if (variant === 'minimal') return { color: headerBg, borderBottom: `2px solid ${headerBg}`, backgroundColor: 'transparent' };
        if (variant === 'solid') return { backgroundColor: headerBg, color: '#fff' };
        if (variant === 'flat') return { backgroundColor: 'transparent', color: headerBg };
        return { backgroundColor: headerBg, color: '#fff' };
    };

    const getBodyStyle = () => {
        if (variant === 'solid') return { backgroundColor: `${headerBg}15` }; 
        return { backgroundColor: bodyBg };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const newVisual: VisualData = {
                    type: 'image',
                    url: ev.target?.result as string,
                    caption: 'Uploaded Image',
                    style: 'normal'
                };
                const currentVisuals = section.visuals || [];
                onUpdate(index, 'visuals', [...currentVisuals, newVisual]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveVisual = (visualIndex: number) => {
        const currentVisuals = section.visuals || [];
        const newVisuals = currentVisuals.filter((_, i) => i !== visualIndex);
        onUpdate(index, 'visuals', newVisuals);
    };

    const handleUpdateVisual = (visualIndex: number, newVisual: VisualData) => {
        const currentVisuals = [...(section.visuals || [])];
        currentVisuals[visualIndex] = newVisual;
        onUpdate(index, 'visuals', currentVisuals);
        setEditingVisualIndex(null);
    };

    return (
        <>
            {dropIndicator === 'top' && <DropPlaceholder />}
            
            <div 
                draggable={isEditing}
                onDragStart={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        // IMPORTANT: Set data for Firefox compatibility
                        e.dataTransfer.setData("text/plain", section.id); 
                        e.dataTransfer.effectAllowed = "move";
                        // Set drag image to be the card itself but clearer? 
                        // Browser default is usually fine.
                        onDragStart(e, section.id);
                    }
                }}
                onDragOver={(e) => isEditing && onDragOver(e, section.id)}
                onDrop={(e) => isEditing && onDrop(e, section.id)}
                onDragEnd={(e) => isEditing && onDragEnd(e)}
                className={`rounded-lg shadow-sm overflow-hidden mb-4 break-inside-avoid relative group transition-all duration-300 ${variant === 'minimal' ? 'border' : ''} ${isEditing ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-300 hover:shadow-xl' : ''} ${isDragged ? 'opacity-40 grayscale border-2 border-indigo-400 border-dashed scale-[0.98]' : ''}`}
                style={{ ...getBodyStyle(), borderColor: variant === 'minimal' ? headerBg : 'transparent' }}
            >
                {/* Header */}
                <div 
                    className={`px-4 py-2 flex items-center justify-between ${variant === 'minimal' ? '' : 'shadow-sm'}`}
                    style={getHeaderStyle()}
                >
                    <div className="flex items-center w-full">
                        {isEditing && (
                             <div className="mr-3 cursor-grab active:cursor-grabbing text-current opacity-50 hover:opacity-100 p-1 hover:bg-black/10 rounded" title="Drag to reorder">
                                 <DragHandleIcon className="w-5 h-5" />
                             </div>
                        )}
                        <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                        {isEditing ? (
                            <input 
                                className="font-bold text-lg bg-transparent border-b border-white/20 focus:outline-none focus:border-white/80 w-full uppercase tracking-wide placeholder-current/50"
                                value={section.title}
                                onChange={(e) => onUpdate(index, 'title', e.target.value)}
                                onFocus={onEditStart}
                            />
                        ) : (
                            <h3 className="font-bold text-lg uppercase tracking-wide">{section.title}</h3>
                        )}
                    </div>
                    {isEditing && (
                        <div className="flex items-center space-x-2 ml-4">
                             <div className="text-[9px] uppercase font-bold tracking-wider opacity-80 min-w-[50px] text-right">
                                {saveStatus === 'unsaved' && <span className="animate-pulse">Editing...</span>}
                                {saveStatus === 'saving' && <span>Saving...</span>}
                                {saveStatus === 'saved' && <span>Saved</span>}
                             </div>

                             <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 hover:bg-black/10 rounded-full transition" title="Customize Card">
                                <CogIcon className="w-4 h-4 text-current" />
                            </button>
                            <button onClick={() => onDelete(index)} className="p-1.5 hover:bg-red-500/80 rounded-full transition text-white/70 hover:text-white" title="Delete Section">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Settings Panel (Inline) */}
                {isEditing && showSettings && (
                     <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap gap-4 text-[11px] shadow-inner animate-fadeIn">
                         <div>
                            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Style</label>
                            <div className="flex gap-1">
                                {['default', 'minimal', 'solid'].map(v => (
                                    <button 
                                        key={v}
                                        onClick={() => onUpdate(index, 'design', { ...section.design, variant: v })}
                                        className={`px-2 py-1 rounded-md capitalize border transition-all ${section.design?.variant === v ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                         </div>
                         <div>
                            <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Icon</label>
                            <div className="flex gap-1">
                                {['academic', 'chart', 'beaker', 'bulb', 'target'].map(k => {
                                    const Ico = iconMap[k];
                                    return (
                                    <button 
                                        key={k}
                                        onClick={() => onUpdate(index, 'design', { ...section.design, icon: k })}
                                        className={`p-1.5 rounded-md border transition-all ${section.design?.icon === k ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
                                    >
                                        <Ico className="w-4 h-4" />
                                    </button>
                                )})}
                            </div>
                         </div>
                          <div className="flex gap-4">
                             <div>
                                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Header Color</label>
                                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 p-1 pr-2">
                                    <input 
                                        type="color" 
                                        value={section.design?.customColor || theme.headingColor} 
                                        onChange={(e) => onUpdate(index, 'design', { ...section.design, customColor: e.target.value })}
                                        className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="font-mono text-slate-400">{section.design?.customColor || theme.headingColor}</span>
                                </div>
                             </div>
                             <div>
                                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider">Body Color</label>
                                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 p-1 pr-2">
                                    <input 
                                        type="color" 
                                        value={section.design?.customBackgroundColor || theme.sectionBackgroundColor} 
                                        onChange={(e) => onUpdate(index, 'design', { ...section.design, customBackgroundColor: e.target.value })}
                                        className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="font-mono text-slate-400">{section.design?.customBackgroundColor || theme.sectionBackgroundColor}</span>
                                </div>
                             </div>
                         </div>
                     </div>
                )}

                {/* Body */}
                <div className="p-4 space-y-4">
                    {isEditing ? (
                        <textarea 
                            className="w-full min-h-[120px] mb-4 p-3 bg-white border border-slate-200 rounded-md text-slate-800 text-xs leading-relaxed resize-y focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
                            value={localContent}
                            onChange={handleContentChange}
                            onBlur={handleBlur}
                            onFocus={onEditStart}
                        />
                    ) : (
                        <div className="text-sm leading-relaxed text-left whitespace-pre-line break-words hyphens-auto" style={{ color: theme.sectionBodyColor }}>
                             <MarkdownText text={section.content} />
                        </div>
                    )}

                    {/* Visuals Grid */}
                    {section.visuals && section.visuals.length > 0 && (
                        <div className={`grid gap-3 ${section.visuals.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {section.visuals.map((vis, vIdx) => (
                                <div key={vIdx} className="relative group/vis bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                                     <div 
                                        className="cursor-pointer hover:opacity-95 transition-opacity"
                                        onClick={() => setLightboxVisual(vis)}
                                     >
                                        {vis.type === 'image' && (
                                            <img 
                                                src={vis.url} 
                                                alt={vis.caption} 
                                                className="w-full h-auto max-h-[160px] object-contain mx-auto bg-slate-50"
                                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Error'; }}
                                            />
                                        )}
                                        {vis.type === 'donutChart' && 'items' in vis && <DonutChart items={vis.items || []} />}
                                        {vis.type === 'lineChart' && 'labels' in vis && <LineChart labels={vis.labels || []} datasets={vis.datasets || []} />}
                                        {vis.type === 'barChart' && 'labels' in vis && <BarChart labels={vis.labels || []} datasets={vis.datasets || []} />}
                                        {vis.type === 'table' && 'headers' in vis && <TableRenderer headers={vis.headers || []} rows={vis.rows || []} />}
                                     </div>

                                     {vis.caption && (
                                         <p className="text-center text-slate-500 italic text-[10px] p-2 bg-slate-50 border-t border-slate-100">{vis.caption}</p>
                                     )}

                                     {isEditing && (
                                        <div className={`absolute top-2 right-2 flex gap-1 transition duration-200 z-20 ${isEditing ? 'opacity-100' : 'opacity-0 group-hover/vis:opacity-100'}`}>
                                            {['donutChart', 'lineChart', 'barChart'].includes(vis.type) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingVisualIndex(vIdx); }}
                                                    className="bg-white text-slate-600 p-1.5 rounded-full shadow-md border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                    title="Edit Chart Data"
                                                >
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRemoveVisual(vIdx); }}
                                                className="bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition"
                                                title="Remove Visual"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                     )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Visual Button */}
                    {isEditing && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                             <label className="flex items-center justify-center w-full py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition group/add">
                                <UploadIcon className="w-4 h-4 text-slate-400 group-hover/add:text-indigo-500 mr-2" />
                                <span className="text-[11px] text-slate-500 font-medium group-hover/add:text-indigo-600">Add Image / Visual</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </div>
            
            {dropIndicator === 'bottom' && <DropPlaceholder />}

            {/* Lightbox for viewing */}
            {lightboxVisual && <Lightbox visual={lightboxVisual} onClose={() => setLightboxVisual(null)} />}
            
            {/* Chart Editor Modal */}
            {editingVisualIndex !== null && section.visuals?.[editingVisualIndex] && (
                <ChartEditModal 
                    visual={section.visuals[editingVisualIndex]} 
                    onSave={(newVisual) => handleUpdateVisual(editingVisualIndex, newVisual)} 
                    onClose={() => setEditingVisualIndex(null)} 
                />
            )}
        </>
    );
};


// --- MAIN POSTER DISPLAY COMPONENT ---

const PosterDisplay = forwardRef<HTMLDivElement, PosterDisplayProps>(({ 
  data, isEditing = false, onUpdateHeader, onUpdateSection, onUpdateContact, onAddSection, onDeleteSection, onReorderSections, onEditStart 
}, ref) => {
    
  const [sections, setSections] = useState(data.sections);

  useEffect(() => {
      setSections(data.sections);
  }, [data.sections]);

  // Drag and Drop State (ID-based)
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'top' | 'bottom' } | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent) => {
      // Crucial: reset state to remove transparency effects
      setDraggedId(null);
      setDropTarget(null);
  };

  const handleDragOverSection = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (draggedId === null || draggedId === targetId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const midPoint = rect.top + rect.height / 2;
      const position = e.clientY < midPoint ? 'top' : 'bottom';

      setDropTarget({ id: targetId, position });
  };
  
  // NEW: Handle dragging over a column background (to drop at end or empty column)
  const handleDragOverColumn = (e: React.DragEvent, columnId: '1' | '2') => {
      e.preventDefault();
      e.stopPropagation();
      
      if (draggedId === null) return;
      
      const columnSections = sections.filter(s => s.column === columnId);
      
      // If column is empty, we need a special target
      if (columnSections.length === 0) {
          setDropTarget({ id: `column-${columnId}-end`, position: 'bottom' }); // Special ID for empty column
          return;
      }

      // If dragging near the bottom of the column (below the last item)
      const lastSection = columnSections[columnSections.length - 1];
      const rect = e.currentTarget.getBoundingClientRect();
      
      // If pointer is in the bottom 20% of the container or below the last element visually
      if (e.clientY > rect.bottom - 100) {
           setDropTarget({ id: lastSection.id, position: 'bottom' });
      }
  };

  const handleDropSection = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (draggedId === null || dropTarget === null) {
          handleDragEnd(e);
          return;
      }

      const draggedIndex = sections.findIndex(s => s.id === draggedId);
      if (draggedIndex === -1) {
          handleDragEnd(e);
          return;
      }

      const newSections = [...sections];
      const movedItem = { ...newSections[draggedIndex] }; // Clone to avoid mutation issues

      // 1. Remove from old pos
      newSections.splice(draggedIndex, 1);

      // 2. Determine Insertion
      let finalIndex = -1;
      
      // Special case: Dropping into empty column placeholder
      if (targetId.startsWith('column-')) {
           const targetCol = targetId.includes('1') ? '1' : '2';
           movedItem.column = targetCol;
           // Append to end of sections, but logically it should be last of that column
           // Since the array order implies display order (filtered by col), appending is fine IF we sort or if filtering preserves order
           // Actually, we just need to push it to end if it's the only one.
           // Better: Find index of last item in that column, insert after.
           // If empty, just push.
           finalIndex = newSections.length;
      } else {
           // Normal case: Dropping relative to another section
           const targetIndex = newSections.findIndex(s => s.id === targetId);
           if (targetIndex !== -1) {
                const targetItem = newSections[targetIndex];
                movedItem.column = targetItem.column; // Adopt target column
                
                finalIndex = targetIndex;
                if (dropTarget.position === 'bottom') {
                    finalIndex += 1;
                }
           }
      }

      if (finalIndex !== -1) {
          newSections.splice(finalIndex, 0, movedItem);
          setSections(newSections);
          onReorderSections?.(newSections);
      }
      
      handleDragEnd(e);
  };
  
  // Legacy handler if dropping directly on column background without "DropTarget" calculation
  const handleDropToColumnBackground = (e: React.DragEvent, columnId: '1'|'2') => {
       e.preventDefault();
       e.stopPropagation();
       
       if (draggedId === null) {
           handleDragEnd(e);
           return;
       }
       
       // If we have a specific drop target from handleDragOverColumn, let handleDropSection handle it
       if (dropTarget && (dropTarget.id.startsWith('column-') || dropTarget.id.includes(columnId))) {
           handleDropSection(e, dropTarget.id);
           return;
       }
       
       // Fallback: Append to column
       const draggedIndex = sections.findIndex(s => s.id === draggedId);
       if (draggedIndex === -1) {
           handleDragEnd(e);
           return;
       }

       const newSections = [...sections];
       const movedSection = { ...newSections[draggedIndex] };
       
       if(movedSection.column !== columnId) {
            movedSection.column = columnId;
            newSections.splice(draggedIndex, 1);
            newSections.push(movedSection); // Append
            setSections(newSections);
            onReorderSections?.(newSections);
       }
       handleDragEnd(e);
  };

  const leftSections = sections.filter(s => s.column === '1');
  const rightSections = sections.filter(s => s.column !== '1');

  return (
    <div 
        ref={ref} 
        data-id="poster-root"
        className="relative shadow-[0_50px_100px_-20px_rgba(50,50,93,0.25),0_30px_60px_-30px_rgba(0,0,0,0.3)] mx-auto transition-transform flex flex-col poster-shadow"
        style={{
           width: '1753px', // Specific Pixel Width (approx A3 @ 150dpi)
           minHeight: '2480px', // Specific Pixel Height
           height: 'auto',
           backgroundColor: data.theme.backgroundColor,
           transformOrigin: 'top center'
        }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { 
            e.preventDefault(); 
            handleDragEnd(e);
        }}
    >
       {/* WARNINGS BANNER */}
       <WarningsBanner warnings={data.warnings} />

       {/* Background Color Picker Overlay (Edit Mode) */}
       {isEditing && (
            <div className="absolute top-4 right-4 z-30 group">
                <button className="bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg hover:bg-white transition border border-slate-200 flex items-center gap-2 group-hover:ring-2 ring-indigo-500/20" title="Change Poster Background">
                    <div className="w-6 h-6 rounded-full border border-slate-200 shadow-inner" style={{ backgroundColor: data.theme.backgroundColor }}></div>
                    <span className="text-xs font-semibold text-slate-600 pr-1">Background</span>
                </button>
                <div className="absolute right-0 top-full mt-2 p-4 bg-white rounded-xl shadow-xl hidden group-hover:block z-30 border border-slate-100 w-64 animate-fadeInUp">
                     <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Poster Background</p>
                     <div className="flex gap-3 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input 
                            type="color" 
                            value={data.theme.backgroundColor}
                            onChange={(e) => onUpdateHeader?.('theme', {...data.theme, backgroundColor: e.target.value})} 
                            className="w-10 h-10 cursor-pointer rounded-md overflow-hidden border-0"
                        />
                        <div className="flex flex-col">
                            <span className="text-xs font-mono text-slate-700">{data.theme.backgroundColor}</span>
                            <span className="text-[10px] text-slate-400">Click swatch to edit</span>
                        </div>
                     </div>
                </div>
            </div>
       )}

      {/* 1. Header (Always Desktop Layout for Print) */}
      <header 
        data-id="header-desktop"
        className="w-full p-12 flex justify-between items-start gap-8 relative group/header transition-colors duration-300"
        style={{ backgroundColor: data.theme.headerColor }}
      >
        {isEditing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/header:opacity-100 transition-opacity">
                <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-2 cursor-pointer">
                     <input 
                        type="color" 
                        value={data.theme.headerColor}
                        onChange={(e) => onUpdateHeader?.('theme', {...data.theme, headerColor: e.target.value})} 
                        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
                        title="Change Header Color"
                    />
                    <span className="text-xs font-semibold text-slate-700">Header Color</span>
                </div>
            </div>
        )}

        {/* Left Logo */}
         <div className="w-32 h-32 flex-shrink-0 flex items-start justify-center">
            {data.leftLogoUrl ? (
                <img src={data.leftLogoUrl} alt="Left Logo" className="w-full h-full object-contain filter drop-shadow-md bg-white/95 rounded-xl p-2" />
            ) : <div className="w-full h-full"></div>}
         </div>

         {/* Center Info Cards */}
         <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3 z-10 max-w-4xl">
            {/* Title */}
             {isEditing ? (
              <textarea
                className="w-full bg-black/20 border border-white/30 rounded-xl text-center text-4xl font-extrabold p-4 focus:outline-none focus:border-white focus:bg-black/30 resize-none shadow-lg placeholder-white/50 text-white"
                style={{ color: data.theme.titleColor }}
                value={data.title}
                onChange={(e) => onUpdateHeader?.('title', e.target.value)}
                onFocus={onEditStart}
                rows={2}
                placeholder="Poster Title"
              />
            ) : (
              <h1 className="text-4xl font-extrabold uppercase leading-tight tracking-tight drop-shadow-md break-words max-w-[90%]" style={{ color: data.theme.titleColor }}>
                {data.title}
              </h1>
            )}

            {/* Author Card */}
            <div className={`rounded-lg py-2 px-6 shadow-sm w-full transition-colors ${isEditing ? 'bg-black/20 border border-white/30' : 'bg-white/10 backdrop-blur-sm border border-white/20'}`}>
                {isEditing ? (
                    <input 
                        className="w-full bg-transparent border-b border-white/40 text-center text-white text-base font-bold focus:outline-none focus:border-white placeholder-white/50"
                        value={data.authors.join(', ')}
                        onChange={(e) => onUpdateHeader?.('authors', e.target.value.split(', '))}
                        onFocus={onEditStart}
                        placeholder="Authors (comma separated)"
                    />
                ) : (
                    <p className="text-base font-bold text-white tracking-wide">{data.authors.join(', ')}</p>
                )}
            </div>

            {/* Dept & University - Stacked Vertically */}
            <div className="flex flex-col gap-2 w-full">
                {/* Department Card */}
                <div className={`rounded-md py-1.5 px-4 shadow-sm w-full transition-colors ${isEditing ? 'bg-black/20 border border-white/30' : 'bg-white/5 backdrop-blur-sm border border-white/10'}`}>
                     {isEditing ? (
                        <input 
                             className="w-full bg-transparent border-b border-white/40 text-center text-white text-sm font-medium focus:outline-none focus:border-white placeholder-white/50"
                             value={data.department}
                             onChange={(e) => onUpdateHeader?.('department', e.target.value)}
                             onFocus={onEditStart}
                             placeholder="Department Name"
                        />
                    ) : (
                        <p className="text-sm font-medium text-white/90">{data.department}</p>
                    )}
                </div>

                 {/* University Card */}
                 <div className={`rounded-md py-1.5 px-4 shadow-sm w-full transition-colors ${isEditing ? 'bg-black/20 border border-white/30' : 'bg-white/5 backdrop-blur-sm border border-white/10'}`}>
                     {isEditing ? (
                        <input 
                             className="w-full bg-transparent border-b border-white/40 text-center text-white text-sm font-medium focus:outline-none focus:border-white placeholder-white/50"
                             value={data.university}
                             onChange={(e) => onUpdateHeader?.('university', e.target.value)}
                             onFocus={onEditStart}
                             placeholder="University Name"
                        />
                    ) : (
                        <p className="text-sm font-medium text-white/90">{data.university}</p>
                    )}
                </div>
            </div>
         </div>

         {/* Right Logo */}
         <div className="w-32 h-32 flex-shrink-0 flex items-start justify-center">
             {data.rightLogoUrl ? (
                <img src={data.rightLogoUrl} alt="Right Logo" className="w-full h-full object-contain filter drop-shadow-md bg-white/95 rounded-xl p-2" />
            ) : <div className="w-full h-full"></div>}
         </div>
      </header>

      {/* 2. Main Content Grid (Always 2 Columns) */}
      <div 
        data-id="poster-grid"
        className="flex-grow p-10 flex flex-row gap-6 items-stretch relative"
      >
          {/* Left Column */}
          <div 
            className={`w-1/2 flex flex-col gap-5 min-h-[300px] transition-all rounded-xl ${isEditing ? 'border-2 border-dashed border-slate-300/60 bg-slate-50/50 p-4' : ''}`}
            onDragOver={(e) => isEditing && handleDragOverColumn(e, '1')}
            onDrop={(e) => isEditing && handleDropToColumnBackground(e, '1')}
          >
              {leftSections.map((s, i) => (
                   <SectionCard 
                       key={s.id || i} 
                       section={s} 
                       index={sections.findIndex(sec => sec.id === s.id)}
                       theme={data.theme}
                       isEditing={isEditing}
                       onUpdate={onUpdateSection!}
                       onDelete={onDeleteSection!}
                       onEditStart={onEditStart!}
                       onDragStart={handleDragStart}
                       onDragOver={handleDragOverSection}
                       onDrop={handleDropSection}
                       onDragEnd={handleDragEnd}
                       isDragged={draggedId === s.id}
                       dropIndicator={dropTarget?.id === s.id ? dropTarget.position : null}
                   />
              ))}
              {/* Empty Column Drop Placeholder */}
              {isEditing && dropTarget?.id === 'column-1-end' && (
                  <DropPlaceholder />
              )}

              {leftSections.length === 0 && isEditing && !dropTarget?.id?.includes('column-1') && (
                   <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-lg p-4 pointer-events-none">
                       Drop items here
                   </div>
              )}
              {isEditing && (
                  <button onClick={() => onAddSection?.('1')} className="mt-2 flex items-center justify-center py-6 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-500 transition shadow-sm text-sm font-bold uppercase tracking-wide">
                      <PlusIcon className="w-5 h-5 mr-2" /> Add Section
                  </button>
              )}
          </div>

          {/* Right Column */}
          <div 
            className={`w-1/2 flex flex-col gap-5 min-h-[300px] transition-all rounded-xl ${isEditing ? 'border-2 border-dashed border-slate-300/60 bg-slate-50/50 p-4' : ''}`}
            onDragOver={(e) => isEditing && handleDragOverColumn(e, '2')}
            onDrop={(e) => isEditing && handleDropToColumnBackground(e, '2')}
          >
               {rightSections.map((s, i) => (
                   <SectionCard 
                       key={s.id || i} 
                       section={s} 
                       index={sections.findIndex(sec => sec.id === s.id)}
                       theme={data.theme}
                       isEditing={isEditing}
                       onUpdate={onUpdateSection!}
                       onDelete={onDeleteSection!}
                       onEditStart={onEditStart!}
                       onDragStart={handleDragStart}
                       onDragOver={handleDragOverSection}
                       onDrop={handleDropSection}
                       onDragEnd={handleDragEnd}
                       isDragged={draggedId === s.id}
                       dropIndicator={dropTarget?.id === s.id ? dropTarget.position : null}
                   />
              ))}
              {/* Empty Column Drop Placeholder */}
              {isEditing && dropTarget?.id === 'column-2-end' && (
                  <DropPlaceholder />
              )}
               {rightSections.length === 0 && isEditing && !dropTarget?.id?.includes('column-2') && (
                   <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-lg p-4 pointer-events-none">
                       Drop items here
                   </div>
              )}
               {isEditing && (
                  <button onClick={() => onAddSection?.('2')} className="mt-2 flex items-center justify-center py-6 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-500 transition shadow-sm text-sm font-bold uppercase tracking-wide">
                      <PlusIcon className="w-5 h-5 mr-2" /> Add Section
                  </button>
              )}
          </div>
      </div>

      {/* 3. Footer */}
      <footer 
        className="w-full text-white mt-auto flex-grow-0"
        style={{ backgroundColor: data.theme.headerColor }}
      >
         <div className="flex flex-row justify-between items-center p-8 text-xs border-t border-white/10 gap-6">
            <div className="flex flex-col space-y-2 mb-0">
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white focus:outline-none w-64"
                         value={data.contactInfo.email}
                         onChange={(e) => onUpdateContact?.('email', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center font-medium"><MailIcon className="w-4 h-4 mr-3 opacity-70" /> {data.contactInfo.email}</div>
                )}
                
                {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white focus:outline-none w-64"
                         value={data.contactInfo.phone}
                         onChange={(e) => onUpdateContact?.('phone', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                     <div className="flex items-center font-medium"><PhoneIcon className="w-4 h-4 mr-3 opacity-70" /> {data.contactInfo.phone}</div>
                )}
            </div>

            <div className="flex flex-col items-center space-y-2 mb-0 text-center">
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white text-center focus:outline-none w-64"
                         value={data.contactInfo.location}
                         onChange={(e) => onUpdateContact?.('location', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center font-medium"><LocationMarkerIcon className="w-4 h-4 mr-2 opacity-70" /> {data.contactInfo.location}</div>
                )}
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white text-center focus:outline-none w-64"
                         value={data.contactInfo.website}
                         onChange={(e) => onUpdateContact?.('website', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center font-medium"><GlobeAltIcon className="w-4 h-4 mr-2 opacity-70" /> {data.contactInfo.website}</div>
                )}
            </div>

            <div className="flex-shrink-0">
                <div className="bg-white p-2 rounded-xl shadow-lg">
                     <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.contactInfo.website || 'https://www.google.com')}`} 
                        alt="QR Code" 
                        className="w-20 h-20"
                     />
                </div>
            </div>
         </div>
      </footer>
    </div>
  );
});

export default PosterDisplay;