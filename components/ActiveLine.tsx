import React, { RefObject } from 'react';
import { ThemeColors } from '../types';
import { formatNumber } from '../utils';

interface ActiveLineProps {
    currentInput: string;
    livePreview: number;
    themeColors: ThemeColors;
    inputRef: RefObject<HTMLInputElement>;
}

export const ActiveLine: React.FC<ActiveLineProps> = ({ currentInput, livePreview, themeColors, inputRef }) => (
    <div className={`flex justify-between items-center border-b border-gray-400 border-dotted py-3 px-2 shadow-sm`}>
         <input
            ref={inputRef}
            type="text"
            inputMode="none"
            className={`w-full bg-transparent outline-none text-xl font-mono ${themeColors.text}`}
            value={currentInput}
            onChange={() => {}} 
            autoFocus
         />
         <span className={`${themeColors.subText} text-lg font-medium whitespace-nowrap pl-2`}>
            {currentInput ? formatNumber(livePreview) : ''}
         </span>
    </div>
);