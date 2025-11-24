import React, { RefObject } from 'react';
import { ThemeColors, DecimalConfig, NumberFormat } from '../types';
import { formatNumber } from '../utils';

interface ActiveLineProps {
    currentInput: string;
    livePreview: number;
    themeColors: ThemeColors;
    inputRef: RefObject<HTMLInputElement>;
    decimalConfig: DecimalConfig;
    numberFormat: NumberFormat;
}

export const ActiveLine: React.FC<ActiveLineProps> = ({ currentInput, livePreview, themeColors, inputRef, decimalConfig, numberFormat }) => (
    <div className={`flex justify-between items-center border-b border-gray-400 border-dotted py-1.5 px-2 shadow-sm`}>
         <input
            ref={inputRef}
            type="text"
            inputMode="none"
            className={`w-full bg-transparent outline-none text-2xl font-mono ${themeColors.text}`}
            value={currentInput}
            onChange={() => {}} 
            autoFocus
         />
         <span className={`${themeColors.subText} text-xl font-medium whitespace-nowrap pl-2`}>
            {currentInput ? formatNumber(livePreview, decimalConfig, numberFormat) : ''}
         </span>
    </div>
);