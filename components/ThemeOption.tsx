import React from 'react';
import { LucideIcon, Check } from 'lucide-react';
import { ThemeColors } from '../types';
import { triggerHaptic } from '../utils';

interface ThemeOptionProps {
    id: string;
    label: string;
    icon: LucideIcon;
    currentTheme: string;
    setTheme: (id: string) => void;
    themeColors: ThemeColors;
}

export const ThemeOption: React.FC<ThemeOptionProps> = ({ id, label, icon: Icon, currentTheme, setTheme, themeColors }) => (
    <button 
        onClick={() => {
            triggerHaptic();
            setTheme(id);
        }} 
        className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all ${
            currentTheme === id 
            ? themeColors.menuItemActive + ' border-transparent' 
            : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover
        }`}
    >
        <div className="flex items-center gap-3">
            <Icon size={20} />
            <span className="font-semibold">{label}</span>
        </div>
        {currentTheme === id && <Check size={20} />}
    </button>
);