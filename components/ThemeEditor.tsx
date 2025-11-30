
import React from 'react';
import type { PosterTheme } from '../types';
import { PaletteIcon } from './IconComponents';

interface ThemeEditorProps {
  theme: PosterTheme;
  onThemeChange: (newTheme: PosterTheme) => void;
}

const predefinedPalettes: { name: string; theme: PosterTheme }[] = [
  {
    name: 'Academic Blue',
    theme: {
      backgroundColor: '#f0f4f8',
      headerColor: '#2c3e50',
      titleColor: '#ffffff',
      headingColor: '#1a5276',
      textColor: '#34495e',
      accentColor: '#3498db',
      sectionBackgroundColor: '#ffffff',
      sectionBodyColor: '#34495e',
    },
  },
  {
    name: 'Eco Green',
    theme: {
      backgroundColor: '#f1f8f5',
      headerColor: '#2d6a4f',
      titleColor: '#ffffff',
      headingColor: '#1b4332',
      textColor: '#2d332e',
      accentColor: '#52b788',
      sectionBackgroundColor: '#ffffff',
      sectionBodyColor: '#2d332e',
    },
  },
  {
    name: 'Modern Crimson',
    theme: {
      backgroundColor: '#fdf2f2',
      headerColor: '#4a0404',
      titleColor: '#ffffff',
      headingColor: '#9b2226',
      textColor: '#333333',
      accentColor: '#ae2012',
      sectionBackgroundColor: '#fffafa',
      sectionBodyColor: '#333333',
    },
  },
  {
    name: 'Scholarly Slate',
    theme: {
        backgroundColor: '#f4f4f5',
        headerColor: '#27272a',
        titleColor: '#fafafa',
        headingColor: '#3f3f46',
        textColor: '#18181b',
        accentColor: '#71717a',
        sectionBackgroundColor: '#ffffff',
        sectionBodyColor: '#18181b',
    },
  }
];

const colorFields: { key: keyof PosterTheme; label: string }[] = [
    { key: 'backgroundColor', label: 'Canvas' },
    { key: 'headerColor', label: 'Header & Footer' },
    { key: 'titleColor', label: 'Main Title' },
    { key: 'headingColor', label: 'Section Headers' },
    { key: 'sectionBackgroundColor', label: 'Card Background' },
    { key: 'sectionBodyColor', label: 'Card Text' },
    { key: 'textColor', label: 'Global Text' },
    { key: 'accentColor', label: 'Accents' },
];

const ThemeEditor: React.FC<ThemeEditorProps> = ({ theme, onThemeChange }) => {
  const handleColorChange = (key: keyof PosterTheme, value: string) => {
    onThemeChange({ ...theme, [key]: value });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
        <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Preset Themes</h3>
            <div className="grid grid-cols-2 gap-3">
                {predefinedPalettes.map(palette => (
                    <button 
                        key={palette.name} 
                        onClick={() => onThemeChange(palette.theme)} 
                        className="p-3 border border-slate-100 rounded-xl hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20 transition-all text-left group bg-white shadow-sm hover:shadow-md"
                    >
                        <div className="flex space-x-1 rounded-lg overflow-hidden h-6 w-full shadow-inner mb-2">
                            <div className="flex-1" style={{ backgroundColor: palette.theme.headerColor }}></div>
                            <div className="flex-1" style={{ backgroundColor: palette.theme.headingColor }}></div>
                            <div className="flex-1" style={{ backgroundColor: palette.theme.accentColor }}></div>
                            <div className="flex-1" style={{ backgroundColor: palette.theme.backgroundColor }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-700 block">{palette.name}</span>
                    </button>
                ))}
            </div>
        </div>
        
        <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Custom Colors</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {colorFields.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                    <label htmlFor={key} className="text-xs font-semibold text-slate-600">{label}</label>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-colors">
                        <input
                            type="color"
                            id={key}
                            value={theme[key]}
                            onChange={(e) => handleColorChange(key, e.target.value)}
                            className="h-8 w-8 block bg-transparent border-0 p-0 rounded-lg cursor-pointer shadow-sm"
                        />
                         <span className="text-[10px] font-mono text-slate-500 uppercase flex-1">{theme[key]}</span>
                    </div>
                </div>
            ))}
            </div>
        </div>
    </div>
  );
};

export default ThemeEditor;