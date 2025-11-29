
import React, { forwardRef, useState, useEffect } from 'react';
import type { PosterData, VisualData, PosterSection, SectionDesign } from '../types';
import { 
    AcademicCapIcon, BeakerIcon, ChartBarIcon, ClipboardCheckIcon, 
    MailIcon, PhoneIcon, LocationMarkerIcon, GlobeAltIcon, TableIcon, 
    UploadIcon, TrashIcon, PlusIcon, CogIcon, iconMap, PencilIcon, DragHandleIcon
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
  const parts = safeText.split(/(\*\*.*?\*\*|_.*?_|\*.*?\*)/g);
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
// (Charts components remain same, just condensed for brevity in file)

const DonutChart: React.FC<{ items: { label: string; value: number; color: string }[]; caption?: string }> = ({ items, caption }) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    const total = items.reduce((acc, item) => acc + (Number(item?.value) || 0), 0);
    if (total === 0) return null;

    let currentAngle = 0;

    return (
        <div className="flex flex-col items-center justify-center p-1 w-full">
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
        <div className="w-full p-1">
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
       <div className="w-full p-1">
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
                                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[8px] bg-black text-white px-1 py-0 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                                            {val}
                                        </div>
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
      <div className="w-full p-1 overflow-x-auto">
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


// --- SECTION CARD COMPONENT ---

const SectionCard: React.FC<{
    section: PosterSection;
    index: number;
    theme: PosterData['theme'];
    isEditing: boolean;
    onUpdate: (index: number, field: string, value: any) => void;
    onDelete: (index: number) => void;
    onEditStart: () => void;
    onDragStart: (e: React.DragEvent, index: number) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetIndex: number, targetColumn: '1'|'2') => void;
}> = ({ section, index, theme, isEditing, onUpdate, onDelete, onEditStart, onDragStart, onDragOver, onDrop }) => {
    
    const iconKey = section.design?.icon || Object.keys(defaultSectionIconMap).find(k => section.title.toLowerCase().includes(k)) || 'clipboard';
    const Icon = iconMap[defaultSectionIconMap[iconKey] || iconKey] || iconMap['clipboard'];
    const [showSettings, setShowSettings] = useState(false);
    const [lightboxVisual, setLightboxVisual] = useState<VisualData | null>(null);

    // Dynamic Styles
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
        if (variant === 'solid') return { backgroundColor: `${headerBg}15` }; // 15 = low opacity hex
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

    return (
        <>
            <div 
                draggable={isEditing}
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, index, section.column as '1'|'2')}
                className={`rounded-lg shadow-sm overflow-hidden mb-3 break-inside-avoid relative group transition-all duration-300 ${variant === 'minimal' ? 'border' : ''} ${isEditing ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-300 hover:shadow-lg' : ''}`}
                style={{ ...getBodyStyle(), borderColor: variant === 'minimal' ? headerBg : 'transparent' }}
            >
                {/* Header */}
                <div 
                    className={`px-3 py-1.5 flex items-center justify-between ${variant === 'minimal' ? '' : 'shadow-sm'}`}
                    style={getHeaderStyle()}
                >
                    <div className="flex items-center w-full">
                        {isEditing && (
                             <div className="mr-2 cursor-grab active:cursor-grabbing text-current opacity-50 hover:opacity-100" title="Drag to reorder">
                                 <DragHandleIcon className="w-4 h-4" />
                             </div>
                        )}
                        <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                        {isEditing ? (
                            <input 
                                className="font-bold text-base bg-transparent border-b border-white/40 focus:outline-none focus:border-white w-full uppercase tracking-wide"
                                value={section.title}
                                onChange={(e) => onUpdate(index, 'title', e.target.value)}
                                onFocus={onEditStart}
                            />
                        ) : (
                            <h3 className="font-bold text-base uppercase tracking-wide">{section.title}</h3>
                        )}
                    </div>
                    {isEditing && (
                        <div className="flex items-center space-x-2 ml-4">
                             <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-white/20 rounded-full transition" title="Settings">
                                <CogIcon className="w-3.5 h-3.5 text-current" />
                            </button>
                            <button onClick={() => onDelete(index)} className="p-1 hover:bg-red-500/80 rounded-full transition" title="Delete Section">
                                <TrashIcon className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Settings Panel */}
                {isEditing && showSettings && (
                     <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-2 text-[10px] shadow-inner">
                         <div>
                            <label className="block font-semibold text-slate-600 mb-0.5">Variant</label>
                            <div className="flex gap-1">
                                {['default', 'minimal', 'solid'].map(v => (
                                    <button 
                                        key={v}
                                        onClick={() => onUpdate(index, 'design', { ...section.design, variant: v })}
                                        className={`px-1.5 py-0.5 rounded capitalize border ${section.design?.variant === v ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-white text-slate-600'}`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                         </div>
                         <div>
                            <label className="block font-semibold text-slate-600 mb-0.5">Icon</label>
                            <div className="flex gap-1">
                                {['academic', 'chart', 'beaker', 'bulb', 'target'].map(k => {
                                    const Ico = iconMap[k];
                                    return (
                                    <button 
                                        key={k}
                                        onClick={() => onUpdate(index, 'design', { ...section.design, icon: k })}
                                        className={`p-1 rounded hover:bg-slate-200 ${section.design?.icon === k ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500'}`}
                                    >
                                        <Ico className="w-3 h-3" />
                                    </button>
                                )})}
                            </div>
                         </div>
                          <div className="flex gap-3">
                             <div>
                                <label className="block font-semibold text-slate-600 mb-0.5">Header</label>
                                <input 
                                    type="color" 
                                    value={section.design?.customColor || theme.headingColor} 
                                    onChange={(e) => onUpdate(index, 'design', { ...section.design, customColor: e.target.value })}
                                    className="h-5 w-8 p-0 rounded cursor-pointer border-0 shadow-sm"
                                />
                             </div>
                             <div>
                                <label className="block font-semibold text-slate-600 mb-0.5">Body</label>
                                <input 
                                    type="color" 
                                    value={section.design?.customBackgroundColor || theme.sectionBackgroundColor} 
                                    onChange={(e) => onUpdate(index, 'design', { ...section.design, customBackgroundColor: e.target.value })}
                                    className="h-5 w-8 p-0 rounded cursor-pointer border-0 shadow-sm"
                                />
                             </div>
                         </div>
                     </div>
                )}

                {/* Body */}
                <div className="p-3 space-y-3">
                    {isEditing ? (
                        <textarea 
                            className="w-full h-full min-h-[80px] p-2 bg-slate-50/50 border border-slate-200 rounded text-slate-800 text-xs leading-relaxed resize-y focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:bg-white transition-colors"
                            value={section.content}
                            onChange={(e) => onUpdate(index, 'content', e.target.value)}
                            onFocus={onEditStart}
                        />
                    ) : (
                        <div className="text-xs leading-relaxed text-justify whitespace-pre-line break-words hyphens-auto" style={{ color: theme.sectionBodyColor }}>
                             <MarkdownText text={section.content} />
                        </div>
                    )}

                    {/* Visuals Grid */}
                    {section.visuals && section.visuals.length > 0 && (
                        <div className={`grid gap-2 ${section.visuals.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
                                                className="w-full h-auto max-h-[150px] object-contain mx-auto bg-slate-50"
                                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Error'; }}
                                            />
                                        )}
                                        {vis.type === 'donutChart' && 'items' in vis && <DonutChart items={vis.items || []} />}
                                        {vis.type === 'lineChart' && 'labels' in vis && <LineChart labels={vis.labels || []} datasets={vis.datasets || []} />}
                                        {vis.type === 'barChart' && 'labels' in vis && <BarChart labels={vis.labels || []} datasets={vis.datasets || []} />}
                                        {vis.type === 'table' && 'headers' in vis && <TableRenderer headers={vis.headers || []} rows={vis.rows || []} />}
                                     </div>

                                     {vis.caption && (
                                         <p className="text-center text-slate-500 italic text-[9px] p-1 bg-slate-50 border-t border-slate-100">{vis.caption}</p>
                                     )}

                                     {isEditing && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveVisual(vIdx); }}
                                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover/vis:opacity-100 transition shadow-lg z-10"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                     )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Visual Button */}
                    {isEditing && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                             <label className="flex items-center justify-center w-full p-1.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition group/add">
                                <UploadIcon className="w-3.5 h-3.5 text-slate-400 group-hover/add:text-indigo-500 mr-2" />
                                <span className="text-[10px] text-slate-500 font-medium group-hover/add:text-indigo-600">Add Image</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {lightboxVisual && <Lightbox visual={lightboxVisual} onClose={() => setLightboxVisual(null)} />}
        </>
    );
};


// --- MAIN POSTER DISPLAY COMPONENT ---

const PosterDisplay = forwardRef<HTMLDivElement, PosterDisplayProps>(({ 
  data, isEditing = false, onUpdateHeader, onUpdateSection, onUpdateContact, onAddSection, onDeleteSection, onReorderSections, onEditStart 
}, ref) => {
    
  const [sections, setSections] = useState(data.sections);

  // Sync internal state if data prop changes (e.g. from history undo)
  useEffect(() => {
      setSections(data.sections);
  }, [data.sections]);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetColumn: '1'|'2') => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === targetIndex) return;
      
      const newSections = [...sections];
      const movedSection = newSections[draggedIndex];
      movedSection.column = targetColumn;

      // Remove from old position
      newSections.splice(draggedIndex, 1);
      
      // Re-insert at target position (approximate)
      newSections.splice(targetIndex, 0, movedSection);
      
      setSections(newSections);
      onReorderSections?.(newSections);
      setDraggedIndex(null);
  };
  
  const handleDropToColumn = (e: React.DragEvent, targetColumn: '1'|'2') => {
       e.preventDefault();
       e.stopPropagation();
       if (draggedIndex === null) return;

       const newSections = [...sections];
       const movedSection = newSections[draggedIndex];
       
       if(movedSection.column !== targetColumn) {
            movedSection.column = targetColumn;
            newSections.splice(draggedIndex, 1);
            newSections.push(movedSection);
            setSections(newSections);
            onReorderSections?.(newSections);
       }
       setDraggedIndex(null);
  };

  const leftSections = sections.map((s, i) => ({...s, originalIndex: i})).filter(s => s.column === '1');
  const rightSections = sections.map((s, i) => ({...s, originalIndex: i})).filter(s => s.column !== '1');

  return (
    <div 
        ref={ref} 
        data-id="poster-root"
        className="relative bg-white shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] overflow-hidden mx-auto transition-all flex flex-col"
        style={{
           width: '100%', 
           maxWidth: '1123px', 
           minHeight: '1588px',
           backgroundColor: data.theme.backgroundColor
        }}
    >
       {/* Background Color Picker Overlay (Edit Mode) */}
       {isEditing && (
            <div className="absolute top-2 right-2 z-20 group">
                <button className="bg-white/90 backdrop-blur p-2 rounded-full shadow hover:bg-white transition border border-slate-200" title="Change Poster Background">
                    <div className="w-5 h-5 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: data.theme.backgroundColor }}></div>
                </button>
                <div className="absolute right-0 top-full mt-2 p-3 bg-white rounded-xl shadow-xl hidden group-hover:block z-30 border border-slate-100 w-48">
                     <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Poster Background</p>
                     <div className="flex gap-2 items-center">
                        <input 
                            type="color" 
                            value={data.theme.backgroundColor}
                            onChange={(e) => onUpdateHeader?.('theme', {...data.theme, backgroundColor: e.target.value})} 
                            className="w-8 h-8 cursor-pointer rounded overflow-hidden border-0"
                        />
                        <span className="text-xs text-slate-500 font-mono">{data.theme.backgroundColor}</span>
                     </div>
                </div>
            </div>
       )}

      {/* 1. Header (Desktop View) */}
      <header 
        data-id="header-desktop"
        className="w-full p-6 lg:p-8 flex justify-between items-start gap-6 relative group/header"
        style={{ backgroundColor: data.theme.headerColor }}
      >
        {isEditing && (
            <div className="absolute top-2 right-1/2 translate-x-1/2 z-20 opacity-0 group-hover/header:opacity-100 transition">
                 <input 
                    type="color" 
                    value={data.theme.headerColor}
                    onChange={(e) => onUpdateHeader?.('theme', {...data.theme, headerColor: e.target.value})} 
                    className="w-6 h-6 rounded cursor-pointer border-2 border-white shadow-sm"
                    title="Change Header Color"
                />
            </div>
        )}

        {/* Left Logo */}
         <div className="w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0 flex items-start justify-center">
            {data.leftLogoUrl ? (
                <img src={data.leftLogoUrl} alt="Left Logo" className="w-full h-full object-contain filter drop-shadow-md bg-white/95 rounded-xl p-2" />
            ) : <div className="w-full h-full"></div>}
         </div>

         {/* Center Info Cards */}
         <div className="flex-grow flex flex-col items-center justify-center text-center space-y-2">
            {/* Title */}
             {isEditing ? (
              <textarea
                className="w-full bg-white/10 border border-white/30 rounded-lg text-center text-xl lg:text-3xl font-extrabold p-3 focus:outline-none focus:border-white focus:bg-white/20 resize-none shadow-lg placeholder-white/50"
                style={{ color: data.theme.titleColor }}
                value={data.title}
                onChange={(e) => onUpdateHeader?.('title', e.target.value)}
                onFocus={onEditStart}
                rows={2}
              />
            ) : (
              <h1 className="text-2xl lg:text-3xl font-extrabold uppercase leading-tight tracking-tight drop-shadow-sm" style={{ color: data.theme.titleColor }}>
                {data.title}
              </h1>
            )}

            {/* Author Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-1.5 px-4 shadow-sm w-full max-w-2xl">
                {isEditing ? (
                    <input 
                        className="w-full bg-transparent border-b border-white/40 text-center text-white text-sm font-bold focus:outline-none focus:border-white placeholder-white/50"
                        value={data.authors.join(', ')}
                        onChange={(e) => onUpdateHeader?.('authors', e.target.value.split(', '))}
                        onFocus={onEditStart}
                    />
                ) : (
                    <p className="text-sm font-bold text-white tracking-wide">{data.authors.join(', ')}</p>
                )}
            </div>

            <div className="flex gap-4 w-full max-w-2xl justify-center">
                {/* Department Card */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md py-1 px-3 shadow-sm flex-1">
                     {isEditing ? (
                        <input 
                             className="w-full bg-transparent border-b border-white/40 text-center text-white text-xs font-medium focus:outline-none focus:border-white"
                             value={data.department}
                             onChange={(e) => onUpdateHeader?.('department', e.target.value)}
                             onFocus={onEditStart}
                        />
                    ) : (
                        <p className="text-xs font-medium text-white/90">{data.department}</p>
                    )}
                </div>

                 {/* University Card */}
                 <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md py-1 px-3 shadow-sm flex-1">
                     {isEditing ? (
                        <input 
                             className="w-full bg-transparent border-b border-white/40 text-center text-white text-xs font-medium focus:outline-none focus:border-white"
                             value={data.university}
                             onChange={(e) => onUpdateHeader?.('university', e.target.value)}
                             onFocus={onEditStart}
                        />
                    ) : (
                        <p className="text-xs font-medium text-white/90">{data.university}</p>
                    )}
                </div>
            </div>
         </div>

         {/* Right Logo */}
         <div className="w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0 flex items-start justify-center">
             {data.rightLogoUrl ? (
                <img src={data.rightLogoUrl} alt="Right Logo" className="w-full h-full object-contain filter drop-shadow-md bg-white/95 rounded-xl p-2" />
            ) : <div className="w-full h-full"></div>}
         </div>
      </header>

      {/* 2. Header (Mobile View) */}
      <header 
         data-id="header-mobile"
         className="hidden lg:hidden w-full p-4 flex-col space-y-3"
         style={{ backgroundColor: data.theme.headerColor }}
      >
           <div className="flex justify-between items-center w-full">
                {data.leftLogoUrl && <img src={data.leftLogoUrl} className="h-10 w-auto object-contain bg-white rounded p-1 shadow-sm"/>}
                {data.rightLogoUrl && <img src={data.rightLogoUrl} className="h-10 w-auto object-contain bg-white rounded p-1 shadow-sm"/>}
           </div>
           <div className="text-center">
             <h1 className="text-lg font-bold uppercase tracking-tight" style={{ color: data.theme.titleColor }}>{data.title}</h1>
             <p className="text-[11px] text-white/90 mt-1">{data.authors.join(', ')}</p>
           </div>
      </header>
      
      {/* 3. Main Content Grid */}
      <div 
        data-id="poster-grid"
        className="flex-grow p-4 lg:p-6 flex flex-col lg:flex-row gap-5 items-stretch"
      >
          {/* Left Column */}
          <div 
            className={`w-full lg:w-1/2 flex flex-col gap-4 min-h-[200px] ${isEditing ? 'border-2 border-dashed border-slate-300/60 bg-slate-50/30 rounded-xl p-3' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropToColumn(e, '1')}
          >
              {leftSections.map((s) => (
                   <SectionCard 
                       key={s.originalIndex} 
                       section={s} 
                       index={s.originalIndex}
                       theme={data.theme}
                       isEditing={isEditing}
                       onUpdate={onUpdateSection!}
                       onDelete={onDeleteSection!}
                       onEditStart={onEditStart!}
                       onDragStart={handleDragStart}
                       onDragOver={handleDragOver}
                       onDrop={handleDrop}
                   />
              ))}
              {isEditing && (
                  <button onClick={() => onAddSection?.('1')} className="mt-2 flex items-center justify-center py-4 bg-white hover:bg-slate-50 text-slate-500 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-500 transition shadow-sm text-sm font-medium">
                      <PlusIcon className="w-4 h-4 mr-2" /> Add Section
                  </button>
              )}
          </div>

          {/* Right Column */}
          <div 
            className={`w-full lg:w-1/2 flex flex-col gap-4 min-h-[200px] ${isEditing ? 'border-2 border-dashed border-slate-300/60 bg-slate-50/30 rounded-xl p-3' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropToColumn(e, '2')}
          >
               {rightSections.map((s) => (
                   <SectionCard 
                       key={s.originalIndex} 
                       section={s} 
                       index={s.originalIndex}
                       theme={data.theme}
                       isEditing={isEditing}
                       onUpdate={onUpdateSection!}
                       onDelete={onDeleteSection!}
                       onEditStart={onEditStart!}
                       onDragStart={handleDragStart}
                       onDragOver={handleDragOver}
                       onDrop={handleDrop}
                   />
              ))}
               {isEditing && (
                  <button onClick={() => onAddSection?.('2')} className="mt-2 flex items-center justify-center py-4 bg-white hover:bg-slate-50 text-slate-500 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-500 transition shadow-sm text-sm font-medium">
                      <PlusIcon className="w-4 h-4 mr-2" /> Add Section
                  </button>
              )}
          </div>
      </div>

      {/* 4. Footer */}
      <footer 
        className="w-full text-white mt-auto flex-grow-0"
        style={{ backgroundColor: data.theme.headerColor }}
      >
         <div className="flex flex-col md:flex-row justify-between items-center p-4 lg:p-6 text-[10px] lg:text-xs border-t border-white/10">
            <div className="flex flex-col space-y-1 mb-3 md:mb-0">
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white focus:outline-none"
                         value={data.contactInfo.email}
                         onChange={(e) => onUpdateContact?.('email', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center"><MailIcon className="w-3.5 h-3.5 mr-2 opacity-80" /> {data.contactInfo.email}</div>
                )}
                
                {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white focus:outline-none"
                         value={data.contactInfo.phone}
                         onChange={(e) => onUpdateContact?.('phone', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                     <div className="flex items-center"><PhoneIcon className="w-3.5 h-3.5 mr-2 opacity-80" /> {data.contactInfo.phone}</div>
                )}
            </div>

            <div className="flex flex-col items-center space-y-1 mb-3 md:mb-0 text-center">
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white text-center focus:outline-none"
                         value={data.contactInfo.location}
                         onChange={(e) => onUpdateContact?.('location', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center"><LocationMarkerIcon className="w-3.5 h-3.5 mr-2 opacity-80" /> {data.contactInfo.location}</div>
                )}
                 {isEditing ? (
                    <input 
                         className="bg-transparent border-b border-white/40 text-white text-center focus:outline-none"
                         value={data.contactInfo.website}
                         onChange={(e) => onUpdateContact?.('website', e.target.value)}
                         onFocus={onEditStart}
                    />
                ) : (
                    <div className="flex items-center"><GlobeAltIcon className="w-3.5 h-3.5 mr-2 opacity-80" /> {data.contactInfo.website}</div>
                )}
            </div>

            <div className="flex-shrink-0">
                <div className="bg-white p-1.5 rounded-lg shadow-lg">
                     <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.contactInfo.website || 'https://www.google.com')}`} 
                        alt="QR Code" 
                        className="w-12 h-12 lg:w-14 lg:h-14"
                     />
                </div>
            </div>
         </div>
      </footer>
    </div>
  );
});

export default PosterDisplay;
