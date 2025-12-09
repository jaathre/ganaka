import React from 'react';
import { ThemeColors, BillItem, DecimalConfig, NumberFormat } from '../types';
import { formatNumber, triggerHaptic, copyToClipboard } from '../utils';

interface CommittedLineProps {
    item: BillItem;
    onClick: (item: BillItem) => void;
    themeColors: ThemeColors;
    mode?: 'GST' | 'TAX';
    decimalConfig: DecimalConfig;
    numberFormat: NumberFormat;
}

export const CommittedLine: React.FC<CommittedLineProps> = ({ item, onClick, themeColors, decimalConfig, numberFormat }) => {
    const handleClick = () => {
        triggerHaptic();
        onClick(item);
    };

    const handleCopyResult = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic();
        copyToClipboard(formatNumber(item.result, decimalConfig, numberFormat));
    };

    if (item.details) {
        const isGst = item.mode === 'GST';
        return (
            <div 
                onClick={handleClick}
                className={`flex flex-col border-b ${themeColors.itemBorder} py-1.5 px-2 cursor-pointer hover:opacity-70 transition-opacity`}
            >
                <div className="flex justify-between items-baseline mb-1">
                    <span className={`${themeColors.text} font-semibold text-xl`}>{item.expression}</span>
                    <span className={`${themeColors.text} text-2xl font-bold`}>{formatNumber(item.details.base, decimalConfig, numberFormat)}</span>
                </div>
                <div className={`text-xs ${themeColors.subText} grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono opacity-90`}>
                    {isGst ? (
                        <>
                            <div className="flex justify-between col-span-2 sm:col-span-1">
                                <span>CGST ({item.details.rate/2}%):</span>
                                <span>{formatNumber(item.details.taxAmt/2, decimalConfig, numberFormat)}</span>
                            </div>
                            <div className="flex justify-between col-span-2 sm:col-span-1">
                                <span>SGST ({item.details.rate/2}%):</span>
                                <span>{formatNumber(item.details.taxAmt/2, decimalConfig, numberFormat)}</span>
                            </div>
                            <div className="flex justify-between col-span-2 font-bold mt-0.5 pt-0.5 border-t border-gray-300/30 text-blue-500">
                                <span>GST ({item.details.rate}%):</span>
                                <span>{formatNumber(item.details.taxAmt, decimalConfig, numberFormat)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between col-span-2 sm:col-span-1 text-red-500 font-bold">
                            <span>Tax ({item.details.rate}%):</span>
                            <span>{formatNumber(item.details.taxAmt, decimalConfig, numberFormat)}</span>
                        </div>
                    )}
                    <div className={`flex justify-between col-span-2 font-extrabold text-sm pt-1 mt-1 border-t border-dashed ${themeColors.itemBorder} opacity-100`}>
                        <span>Item Total:</span>
                        <span 
                            onClick={handleCopyResult}
                            className={`${themeColors.text} active:scale-95 transition-transform`}
                        >
                            {formatNumber(item.result, decimalConfig, numberFormat)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div 
            onClick={handleClick}
            className={`flex justify-between items-baseline border-b ${themeColors.itemBorder} py-1.5 px-2 cursor-pointer hover:opacity-70 transition-opacity`}
        >
            <span className={`${themeColors.subText} text-xl font-mono`}>{item.expression}</span>
            <span 
                onClick={handleCopyResult}
                className={`${themeColors.text} text-2xl font-bold active:scale-95 transition-transform`}
            >
                {formatNumber(item.result, decimalConfig, numberFormat)}
            </span>
        </div>
    );
};