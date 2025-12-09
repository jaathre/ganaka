import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
    RefreshCw, ChevronsLeft, ChevronLeft, CornerDownLeft, 
    ChevronDown, ChevronUp, Clipboard, Radical, Parentheses
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

import { Button } from './components/Button';
import { ActiveLine } from './components/ActiveLine';
import { CommittedLine } from './components/CommittedLine';
import { formatNumber, evaluateExpression, triggerHaptic, copyToClipboard } from './utils';
import { BillItem, ThemeColors, DecimalConfig, NumberFormat } from './types';

// --- Configuration & Globals ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Pastel Theme Colors (Trendy Palette)
const PAGE_STYLES = [
    { bg: 'bg-rose-100', text: 'text-black', highlight: 'text-rose-900' },
    { bg: 'bg-sky-100', text: 'text-black', highlight: 'text-sky-900' },
    { bg: 'bg-emerald-100', text: 'text-black', highlight: 'text-emerald-900' },
    { bg: 'bg-amber-100', text: 'text-black', highlight: 'text-amber-900' },
];

const THEME_COLORS: Record<string, ThemeColors> = {
    light: { 
        bg: 'bg-slate-50', appBg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', 
        border: 'border-slate-100', headerBg: 'bg-white', tabBg: 'bg-slate-50', 
        tabActive: 'bg-white text-black shadow-sm', tabInactive: 'text-slate-400 hover:bg-slate-100', 
        keypadBg: 'bg-slate-50', totalBarBg: 'bg-white', menuBg: 'bg-white', 
        itemBorder: 'border-slate-100', menuItemHover: 'hover:bg-slate-50', 
        menuItemActive: 'bg-slate-100 text-black', activeLineBg: 'bg-white ring-1 ring-slate-100',
        displayBorder: 'border-slate-100'
    }
};

const LabelText: React.FC<{ top: string; bottom: string }> = ({ top, bottom }) => 
    <div className="flex flex-col items-center leading-none">
        <span className="text-sm font-black tracking-wide uppercase">{top}</span>
        <span className="text-[10px] font-bold tracking-wider uppercase mt-1 opacity-60">{bottom}</span>
    </div>;

const App = () => {
    // --- State ---
    const [pages, setPages] = useState<BillItem[][]>(Array.from({ length: 4 }, () => [])); 
    const [currentPage, setCurrentPage] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null); 
    const [, setUserId] = useState<string | null>(null);

    // Modes & Settings
    const [isGstMode, setIsGstMode] = useState(false);
    const [taxRate, ] = useState(18); // Default fixed, since settings removed
    const [availableRates, ] = useState([5, 18, 40]); // Default fixed
    const [decimalConfig, ] = useState<DecimalConfig>(2); // Default
    const [numberFormat, ] = useState<NumberFormat>('IN'); // Default

    // UI State
    const [isKeypadExpanded, setIsKeypadExpanded] = useState(true);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number | null>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    
    // Touch Handling State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Derived Values
    const billItems = pages[currentPage] || [];
    const livePreview = currentInput ? evaluateExpression(currentInput) : 0;
    const grandTotal = billItems.reduce((sum, item) => sum + item.result, 0) + (activeItemId === null ? livePreview : 0);
    const emptyLines = Math.max(0, 3 - billItems.length - (activeItemId === null ? 1 : 0)); 
    
    const themeColors = THEME_COLORS.light;

    // --- Effects ---
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length > 0) {
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const initAuth = async () => {
                    if (initialAuthToken) {
                        try { await signInWithCustomToken(auth, initialAuthToken); } 
                        catch { await signInAnonymously(auth); }
                    } else { await signInAnonymously(auth); }
                };
                const unsubscribe = onAuthStateChanged(auth, (user) => user ? setUserId(user.uid) : initAuth());
                return () => unsubscribe();
            }
        } catch (e) { console.error("Firebase Init Error:", e); }
    }, []);

    useEffect(() => {
        if (activeItemId === null) listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (inputRef.current) inputRef.current.focus();
    }, [billItems.length, currentPage, activeItemId]);

    useLayoutEffect(() => {
        if (cursorPositionRef.current !== null && inputRef.current) {
            inputRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
            cursorPositionRef.current = null; 
        }
    });

    // --- Handlers ---
    const updateCurrentPageItems = (newItems: BillItem[]) => {
        setPages(prev => {
            const newPages = [...prev];
            newPages[currentPage] = newItems;
            return newPages;
        });
    };

    const updateInput = (newString: string, newCursorPos: number | null = null) => {
        setCurrentInput(newString);
        if (newCursorPos !== null) cursorPositionRef.current = newCursorPos;
        if (activeItemId !== null) {
            const newResult = evaluateExpression(newString);
            const updatedItems = billItems.map(item => 
                item.id === activeItemId ? { ...item, expression: newString, result: newResult, details: null } : item
            );
            updateCurrentPageItems(updatedItems);
        }
    };

    const insertAtCursor = (text: string) => {
        if (!inputRef.current) { updateInput(currentInput + text); return; }
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        updateInput(currentInput.substring(0, start) + text + currentInput.substring(end), start + text.length);
    };

    const deleteAtCursor = () => {
        if (!inputRef.current) { updateInput(currentInput.slice(0, -1)); return; }
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        if (start === end) {
            if (start === 0) return;
            updateInput(currentInput.substring(0, start - 1) + currentInput.substring(end), start - 1);
        } else {
            updateInput(currentInput.substring(0, start) + currentInput.substring(end), start);
        }
    };

    const handleLineClick = (item: BillItem) => {
        setActiveItemId(item.id);
        setCurrentInput(item.expression); 
        cursorPositionRef.current = item.expression.length;
        setIsKeypadExpanded(true); // Auto-expand when selecting a line to edit
    };

    const handleTaxCalculation = (isAdd: boolean, rateOverride?: number) => {
        const rateToUse = rateOverride !== undefined ? rateOverride : taxRate;
        const baseVal = evaluateExpression(currentInput);
        if (baseVal === 0 && currentInput === '') return;
        
        const rateDecimal = rateToUse / 100;
        const finalVal = isAdd ? baseVal * (1 + rateDecimal) : baseVal / (1 + rateDecimal);
        const taxAmount = isAdd ? finalVal - baseVal : baseVal - finalVal;

        const newItem: BillItem = {
            id: Date.now(),
            expression: currentInput, 
            result: finalVal,         
            mode: 'GST',
            type: isAdd ? 'add' : 'remove',
            rate: rateToUse,
            details: { base: baseVal, rate: rateToUse, taxAmt: taxAmount }
        };

        updateCurrentPageItems([...billItems, newItem]);
        setCurrentInput(''); 
        cursorPositionRef.current = 0;
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                // Strip commas, currency symbols, and other non-math characters
                // Preserves digits, decimals, operators, parentheses, %, and √
                const sanitized = text.replace(/[^0-9.+\-*/()%√]/g, '');
                if (sanitized) insertAtCursor(sanitized);
            }
        } catch (e) {
            // Fallback for some browsers if needed, but readText is standard now
            console.error(e);
        }
    };

    const handleInput = (value: string) => {
        if (inputRef.current) inputRef.current.focus();

        switch(value) {
            case 'CLEAR_ALL': updateCurrentPageItems([]); setCurrentInput(''); setActiveItemId(null); break;
            case 'CLEAR_LINE': 
                if (currentInput) {
                    updateInput('', 0); 
                } else if (billItems.length > 0) {
                    // Remove the last line if current input is empty
                    updateCurrentPageItems(billItems.slice(0, -1));
                }
                break;
            case 'DELETE': deleteAtCursor(); break;
            case 'NEXT_LINE':
                if (activeItemId !== null) {
                    setActiveItemId(null); setCurrentInput(''); cursorPositionRef.current = 0;
                } else if (currentInput) {
                    const result = evaluateExpression(currentInput);
                    updateCurrentPageItems([...billItems, { id: Date.now(), expression: currentInput, result }]);
                    setCurrentInput(''); cursorPositionRef.current = 0;
                }
                break;
            case '()':
                const openCount = (currentInput.match(/\(/g) || []).length;
                const closeCount = (currentInput.match(/\)/g) || []).length;
                const lastChar = currentInput.slice(-1);
                insertAtCursor((openCount > closeCount && !['(', '+', '-', 'x', '÷', '√'].includes(lastChar)) ? ')' : (/\d|\)/.test(lastChar) ? 'x(' : '('));
                break;
            case 'SQRT':
                insertAtCursor('√');
                break;
            default: insertAtCursor(value);
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50 && currentPage < pages.length - 1) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c + 1); 
        } else if (distance < -50 && currentPage > 0) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c - 1); 
        }
        setTouchStart(null);
        setTouchEnd(null);
    };

    return (
        <div className={`w-full h-[100dvh] ${themeColors.appBg} overflow-hidden flex flex-col relative transition-colors duration-300`}>
            {/* --- Main Content --- */}
            <div className={`flex-1 flex flex-col overflow-hidden relative`}>
                <div className={`flex flex-col flex-1 overflow-hidden`}>
                    
                    {/* Tabbed Pages */}
                    <div className={`grid grid-cols-4 gap-2 p-2 border-b ${themeColors.border} ${themeColors.headerBg} min-h-[52px]`}>
                            {pages.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    triggerHaptic();
                                    setActiveItemId(null);
                                    setCurrentInput('');
                                    setCurrentPage(idx);
                                }}
                                className={`flex items-center justify-center w-full h-9 rounded-lg transition-all duration-200 font-bold text-sm ${
                                    currentPage === idx 
                                    ? `${PAGE_STYLES[idx % PAGE_STYLES.length].bg} ${PAGE_STYLES[idx % PAGE_STYLES.length].text} shadow-sm scale-105` 
                                    : `bg-white text-gray-600 border border-gray-200 shadow-sm hover:bg-gray-50`
                                }`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    {/* List Area */}
                    <div className={`flex-1 overflow-y-auto px-2 pb-2 pt-0 space-y-0 flex flex-col no-scrollbar`} 
                            onTouchStart={(e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); }} 
                            onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)} 
                            onTouchEnd={onTouchEnd}>
                        {billItems.map((item) => (
                            item.id === activeItemId ? 
                            <ActiveLine key={item.id} currentInput={currentInput} livePreview={livePreview} themeColors={themeColors} inputRef={inputRef} decimalConfig={decimalConfig} numberFormat={numberFormat} /> : 
                            <CommittedLine key={item.id} item={item} onClick={handleLineClick} themeColors={themeColors} mode={item.mode} decimalConfig={decimalConfig} numberFormat={numberFormat} />
                        ))}
                        {activeItemId === null && <ActiveLine currentInput={currentInput} livePreview={livePreview} themeColors={themeColors} inputRef={inputRef} decimalConfig={decimalConfig} numberFormat={numberFormat} />}
                        {[...Array(emptyLines)].map((_, i) => (
                            <div key={`empty-${i}`} className={`flex justify-between items-baseline border-b ${themeColors.itemBorder} py-1.5 px-2 opacity-10`}>
                                <div className="h-8 w-full" />
                            </div>
                        ))}
                        <div ref={listEndRef} />
                    </div>
                    
                    {/* Total Bar with Floating Toggle */}
                    <div className={`relative flex items-center justify-between py-1.5 px-4 border-t ${themeColors.border} ${themeColors.totalBarBg} z-10`}>
                        <button 
                            onClick={() => {
                                triggerHaptic();
                                setIsKeypadExpanded(!isKeypadExpanded);
                            }}
                            className={`absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-6 flex items-center justify-center 
                                        bg-white border border-b-0 ${themeColors.border} rounded-t-lg shadow-sm 
                                        text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors z-20`}
                            aria-label={isKeypadExpanded ? "Minimize keypad" : "Expand keypad"}
                        >
                            {isKeypadExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
                        </button>
                        <span className={`text-xl font-bold uppercase tracking-wider ${themeColors.subText}`}>TOTAL =</span>
                        <button 
                            onClick={() => {
                                triggerHaptic();
                                copyToClipboard(grandTotal.toString());
                            }}
                            className={`text-2xl font-bold ${themeColors.text} active:scale-95 transition-transform`}
                        >
                            {formatNumber(grandTotal, decimalConfig, numberFormat)}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Keypad --- */}
            {isKeypadExpanded && (
                <div className={`${themeColors.keypadBg} flex flex-col border-t ${themeColors.border} transition-colors duration-300`}>
                    <div className="p-3 pt-3 grid grid-cols-4 gap-2 pb-6 animate-in slide-in-from-bottom-2 duration-200">
                        {/* Row 1 */}
                        <Button icon={RefreshCw} onClick={() => handleInput('CLEAR_ALL')} className="bg-rose-300 text-black active:bg-rose-400" />
                        <Button icon={ChevronsLeft} onClick={() => handleInput('CLEAR_LINE')} className="bg-orange-200 text-black active:bg-orange-300" />
                        <Button icon={ChevronLeft} onClick={() => handleInput('DELETE')} className="bg-amber-200 text-black active:bg-amber-300" />
                        <Button icon={CornerDownLeft} onClick={() => handleInput('NEXT_LINE')} className="bg-emerald-300 text-black active:bg-emerald-400" />

                        {/* Row 2: Mode Specific */}
                        {isGstMode ? (
                            availableRates.slice(0, 3).map((rate) => (
                                <div key={rate} className="flex flex-col h-16 gap-1">
                                    <button 
                                        onClick={() => { triggerHaptic(); handleTaxCalculation(true, rate); }}
                                        className="flex-1 bg-teal-200 rounded-lg text-black font-bold text-sm shadow-sm active:scale-95 active:bg-teal-300 flex items-center justify-center"
                                    >
                                        +{rate}%
                                    </button>
                                    <button 
                                        onClick={() => { triggerHaptic(); handleTaxCalculation(false, rate); }}
                                        className="flex-1 bg-rose-200 rounded-lg text-black font-bold text-sm shadow-sm active:scale-95 active:bg-rose-300 flex items-center justify-center"
                                    >
                                        -{rate}%
                                    </button>
                                </div>
                            ))
                        ) : (
                            <>
                                <Button icon={Parentheses} onClick={() => handleInput('()')} className="bg-violet-200 text-black active:bg-violet-300 font-bold" />
                                <Button icon={Radical} onClick={() => handleInput('SQRT')} className="bg-yellow-200 text-black active:bg-yellow-300 font-bold" />
                                <Button icon={Clipboard} onClick={handlePaste} className="bg-lime-200 text-black active:bg-lime-300 font-bold" />
                            </>
                        )}
                        
                        {/* Gap filler if gst mode has fewer rates (unlikely with default 3) */}
                        {isGstMode && availableRates.length < 3 && Array.from({ length: 3 - availableRates.length }).map((_, i) => <div key={i} />)}
                        
                        <Button label={<span className="text-xl font-bold">%</span>} onClick={() => handleInput('%')} className="bg-sky-200 text-black active:bg-sky-300 font-bold" />
                        
                        {/* Row 3 */}
                        <Button label="7" onClick={() => handleInput('7')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="8" onClick={() => handleInput('8')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="9" onClick={() => handleInput('9')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="÷" onClick={() => handleInput('÷')} className="bg-indigo-200 text-black active:bg-indigo-300 text-2xl" />
                        
                        {/* Row 4 */}
                        <Button label="4" onClick={() => handleInput('4')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="5" onClick={() => handleInput('5')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="6" onClick={() => handleInput('6')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="x" onClick={() => handleInput('x')} className="bg-cyan-200 text-black active:bg-cyan-300 text-xl" />
                        
                        {/* Row 5 */}
                        <Button label="1" onClick={() => handleInput('1')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="2" onClick={() => handleInput('2')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="3" onClick={() => handleInput('3')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="-" onClick={() => handleInput('-')} className="bg-blue-200 text-black active:bg-blue-300 text-2xl" />
                        
                        {/* Row 6 */}
                        <Button 
                            label={<LabelText top={isGstMode ? "GST" : "BASIC"} bottom="MODE" />} 
                            onClick={() => { triggerHaptic(); setIsGstMode(!isGstMode); }} 
                            className={`${isGstMode ? 'bg-green-100 text-green-900 ring-1 ring-green-200' : 'bg-gray-100 text-gray-900 ring-1 ring-gray-200'} active:scale-95 transition-all`} 
                        />
                        <Button label="0" onClick={() => handleInput('0')} className="bg-white text-black shadow-sm active:bg-gray-100" />
                        <Button label="." onClick={() => handleInput('.')} className="bg-white text-black shadow-sm active:bg-gray-100 font-bold text-xl" />
                        <Button label="+" onClick={() => handleInput('+')} className="bg-purple-200 text-black active:bg-purple-300 text-2xl" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;