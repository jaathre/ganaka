export const formatNumber = (num: number | string): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return isNaN(n) ? "0.00" : n.toFixed(2);
};

export const evaluateExpression = (expr: string): number => {
    try {
        if (!expr) return 0;
        let cleanExpr = expr.replace(/x/g, '*').replace(/÷/g, '/');
        cleanExpr = cleanExpr.replace(/(\d+)%/g, '($1/100)');
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