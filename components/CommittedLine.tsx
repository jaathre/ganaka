import React from 'react';
import { ThemeColors, BillItem } from '../types';
import { formatNumber, triggerHaptic } from '../utils';

interface CommittedLineProps {
    item: BillItem;
    onClick: (item: BillItem) => void;
    themeColors: ThemeColors;
    mode?: 'GST' | 'TAX';
}

export const CommittedLine: React.FC<CommittedLineProps> = ({ item, onClick, themeColors }) => {
    const handleClick = () => {
        triggerHaptic();
        onClick(item);
    };

    if (item.details) {
        const isGst = item.mode === 'GST';
        return (
            <div 
                onClick={handleClick}
                className={`flex flex-col border-b ${themeColors.itemBorder} py-3 px-2 cursor-pointer hover:opacity-70 transition-opacity`}
            >
                <div className="flex justify-between items-baseline mb-1">
                    <span className={`${themeColors.text} font-semibold text-lg`}>{item.expression}</span>
                    <span className={`${themeColors.text} text-xl font-bold`}>{formatNumber(item.details.base)}</span>
                </div>
                <div className={`text-xs ${themeColors.subText} grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono opacity-90`}>
                    {isGst ? (
                        <>
                            <div className="flex justify-between col-span-2 sm:col-span-1">
                                <span>CGST ({item.details.rate/2}%):</span>
                                <span>{formatNumber(item.details.taxAmt/2)}</span>
                            </div>
                            <div className="flex justify-between col-span-2 sm:col-span-1">
                                <span>SGST ({item.details.rate/2}%):</span>
                                <span>{formatNumber(item.details.taxAmt/2)}</span>
                            </div>
                            <div className="flex justify-between col-span-2 font-bold mt-0.5 pt-0.5 border-t border-gray-300/30 text-blue-500">
                                <span>GST ({item.details.rate}%):</span>
                                <span>{formatNumber(item.details.taxAmt)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between col-span-2 sm:col-span-1 text-red-500 font-bold">
                            <span>Tax ({item.details.rate}%):</span>
                            <span>{formatNumber(item.details.taxAmt)}</span>
                        </div>
                    )}
                    <div className={`flex justify-between col-span-2 font-extrabold text-sm pt-1 mt-1 border-t border-dashed ${themeColors.itemBorder} opacity-100`}>
                        <span>Item Total:</span>
                        <span className={themeColors.text}>{formatNumber(item.result)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div 
            onClick={handleClick}
            className={`flex justify-between items-baseline border-b ${themeColors.itemBorder} py-3 px-2 cursor-pointer hover:opacity-70 transition-opacity`}
        >
            <span className={`${themeColors.subText} text-lg font-mono`}>{item.expression}</span>
            <span className={`${themeColors.text} text-xl font-bold`}>{formatNumber(item.result)}</span>
        </div>
    );
};