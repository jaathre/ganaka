import { NumberFormat } from './types';

export const formatNumber = (num: number | string, decimals: 'auto' | number = 'auto', format: NumberFormat = 'IN'): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return "0";

    const opts: Intl.NumberFormatOptions = {};
    
    if (decimals === 'auto') {
        opts.maximumFractionDigits = 10;
    } else {
        // Change minimumFractionDigits to 0 to avoid forcing trailing zeros (e.g. 100.00 -> 100)
        opts.minimumFractionDigits = 0;
        opts.maximumFractionDigits = decimals;
    }

    if (format === 'NONE') {
        if (decimals === 'auto') return parseFloat(n.toFixed(10)).toString();
        // Use parseFloat to strip unnecessary trailing zeros after fixing precision
        return parseFloat(n.toFixed(decimals)).toString();
    }

    const locale = format === 'IN' ? 'en-IN' : 'en-US';
    return new Intl.NumberFormat(locale, opts).format(n);
};

const calculateBODMAS = (expr: string): number => {
    // Custom Shunting Yard Algorithm Implementation
    // Precedence: u (unary) > *, / > +, -
    const ops: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, 'u': 3 };
    const tokens: (number | string)[] = [];
    let num = '';
    
    // 1. Tokenizer
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (/\s/.test(c)) {
            if (num) { tokens.push(parseFloat(num)); num = ''; }
            continue;
        }
        
        if (/[0-9.]/.test(c)) {
            num += c;
        } else if ('+-*/()'.includes(c)) {
            if (num) { tokens.push(parseFloat(num)); num = ''; }
            
            // Handle Unary Minus: '-' is unary if it's start of expr, or follows an operator or '('
            // Note: tokens[tokens.length - 1] check handles previous token context
            const lastToken = tokens[tokens.length - 1];
            const isUnary = c === '-' && (tokens.length === 0 || (typeof lastToken === 'string' && lastToken !== ')'));
            
            if (isUnary) {
                 tokens.push('u');
            } else {
                 tokens.push(c);
            }
        }
    }
    if (num) tokens.push(parseFloat(num));

    // 2. Infix to Postfix (RPN)
    const output: (number | string)[] = [];
    const stack: string[] = [];
    
    for (const token of tokens) {
        if (typeof token === 'number') {
            output.push(token);
        } else if (token === '(') {
            stack.push(token);
        } else if (token === ')') {
            while (stack.length && stack[stack.length - 1] !== '(') {
                const op = stack.pop();
                if (op) output.push(op);
            }
            stack.pop(); // Pop '('
        } else { // Operator
            const currentOp = token as string;
            while (
                stack.length && 
                stack[stack.length - 1] !== '(' &&
                ops[currentOp] <= ops[stack[stack.length - 1]] &&
                currentOp !== 'u' // Unary usually right-associative, simplified here
            ) {
                const op = stack.pop();
                if (op) output.push(op);
            }
            stack.push(currentOp);
        }
    }
    while (stack.length) {
        const op = stack.pop();
        if (op) output.push(op);
    }

    // 3. Evaluation
    const res: number[] = [];
    for (const token of output) {
        if (typeof token === 'number') {
            res.push(token);
        } else if (token === 'u') {
            const a = res.pop();
            if (a === undefined) throw new Error("Invalid Expression");
            res.push(-a);
        } else {
            const b = res.pop();
            const a = res.pop();
            if (a === undefined || b === undefined) throw new Error("Invalid Expression");
            
            switch (token) {
                case '+': res.push(a + b); break;
                case '-': res.push(a - b); break;
                case '*': res.push(a * b); break;
                case '/': res.push(b === 0 ? 0 : a / b); break;
            }
        }
    }
    
    if (res.length !== 1) throw new Error("Invalid Expression");
    return res[0];
};

export const evaluateExpression = (expr: string): number => {
    try {
        if (!expr) return 0;
        let cleanExpr = expr.replace(/x/g, '*').replace(/÷/g, '/');
        
        // Handle "Number +/- Percentage" logic (e.g., 100-5% -> 95, 100+5% -> 105)
        cleanExpr = cleanExpr.replace(/(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)%/g, '$1$2($1*($3/100))');
        
        // Handle remaining percentage operations (e.g. 50*10% or just 20%)
        cleanExpr = cleanExpr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
        
        // Use custom BODMAS parser instead of new Function
        const result = calculateBODMAS(cleanExpr);
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
            navigator.vibrate(10);
        } catch (e) {
            // Ignore errors if vibration is not supported or allowed
        }
    }
};