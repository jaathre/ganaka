import { NumberFormat } from './types';

export const formatNumber = (num: number | string, decimals: 'auto' | number = 'auto', format: NumberFormat = 'IN'): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return "0";

    const opts: Intl.NumberFormatOptions = {};
    
    if (decimals === 'auto') {
        opts.maximumFractionDigits = 10;
    } else {
        opts.minimumFractionDigits = decimals;
        opts.maximumFractionDigits = decimals;
    }

    if (format === 'NONE') {
        if (decimals === 'auto') return parseFloat(n.toFixed(10)).toString();
        return n.toFixed(decimals);
    }

    const locale = format === 'IN' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, opts).format(n);
};

export const evaluateExpression = (expr: string): number => {
    try {
        if (!expr) return 0;
        let cleanExpr = expr.replace(/x/g, '*').replace(/÷/g, '/');
        
        // Handle "Number +/- Percentage" logic (e.g., 100-5% -> 95, 100+5% -> 105)
        cleanExpr = cleanExpr.replace(/(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)%/g, '$1$2($1*($3/100))');
        
        // Handle remaining percentage operations (e.g. 50*10% or just 20%)
        cleanExpr = cleanExpr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
        
        // Security check: only allow digits and math operators
        if (/[^0-9+\-*/().\s]/.test(cleanExpr)) return 0;
        // eslint-disable-next-line no-new-func
        const result = new Function('return ' + cleanExpr)();
        return isFinite(result) ? result : 0;
    } catch {
        return 0;
    }
};

export const copyToClipboard = (text: string): void => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(textArea);
};

export const triggerHaptic = (): void => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(15);
        } catch (e) {
            // Ignore errors if vibration is not supported or allowed
        }
    }
};