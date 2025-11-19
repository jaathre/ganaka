import React from 'react';
import { CirclePercent } from 'lucide-react';
import { ThemeColors } from '../types';
import { triggerHaptic } from '../utils';

interface ModeToggleProps {
    isGstMode: boolean;
    setMode: (mode: boolean) => void;
    themeColors: ThemeColors;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ isGstMode, setMode, themeColors }) => (
    <button
        onClick={() => {
            triggerHaptic();
            setMode(!isGstMode);
        }}
        className={`
            flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 active:scale-95
            hover:bg-gray-100 dark:hover:bg-gray-800
        `}
        title={isGstMode ? "Switch to Tax Mode" : "Switch to GST Mode"}
    >
        <CirclePercent 
            size={20} 
            strokeWidth={2} 
            className={`mb-0.5 transition-colors ${isGstMode ? 'text-green-600 dark:text-green-400' : 'opacity-80'}`} 
        />
        <span className={`text-[9px] font-extrabold leading-none tracking-wide transition-colors ${isGstMode ? 'text-green-600 dark:text-green-400' : 'opacity-80'}`}>
            {isGstMode ? 'GST' : 'TAX'}
        </span>
    </button>
);