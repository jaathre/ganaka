import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
    RefreshCw, ChevronsLeft, ChevronLeft, CornerDownLeft, 
    ChevronDown, ChevronUp, Clipboard, Undo2, Parentheses,
    History, Settings, Moon, Sun, Globe, Hash, Tag, Percent, RotateCcw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

import { Button } from './components/Button';
import { ActiveLine } from './components/ActiveLine';
import { CommittedLine } from './components/CommittedLine';
import { formatNumber, evaluateExpression, triggerHaptic, copyToClipboard } from './utils';
import { BillItem, ThemeColors, DecimalConfig, NumberFormat, ThemeName } from './types';

// --- Configuration & Globals ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Page Styles - Adjusted for better visibility in new Dark Mode
const PAGE_STYLES = [
    { bg: 'bg-rose-100', text: 'text-rose-950', highlight: 'text-rose-900', darkBg: 'bg-rose-950/50', darkText: 'text-rose-200' }, // Master
    { bg: 'bg-sky-100', text: 'text-sky-950', highlight: 'text-sky-900', darkBg: 'bg-sky-950/50', darkText: 'text-sky-200' },   // GST
    { bg: 'bg-emerald-100', text: 'text-emerald-950', highlight: 'text-emerald-900', darkBg: 'bg-emerald-950/50', darkText: 'text-emerald-200' }, // History
    { bg: 'bg-amber-100', text: 'text-amber-950', highlight: 'text-amber-900', darkBg: 'bg-amber-950/50', darkText: 'text-amber-200' }, // Settings
];

const THEME_COLORS: Record<ThemeName, ThemeColors> = {
    light: { 
        bg: 'bg-slate-50', appBg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', 
        border: 'border-slate-100', headerBg: 'bg-white', tabBg: 'bg-slate-50', 
        tabActive: 'bg-white text-slate-900 shadow-sm border-slate-200', tabInactive: 'text-slate-400 hover:bg-slate-100', 
        keypadBg: 'bg-slate-50', totalBarBg: 'bg-white', menuBg: 'bg-white', 
        itemBorder: 'border-slate-100', menuItemHover: 'hover:bg-slate-50', 
        menuItemActive: 'bg-slate-100 text-slate-900', activeLineBg: 'bg-white ring-1 ring-slate-100',
        displayBorder: 'border-slate-100'
    },
    // New "True Dark" Theme
    dark: {
        bg: 'bg-black', appBg: 'bg-black', text: 'text-zinc-200', subText: 'text-zinc-600', 
        border: 'border-zinc-900', headerBg: 'bg-black', tabBg: 'bg-black', 
        tabActive: 'bg-zinc-900 text-white border-zinc-800 shadow-[0_0_10px_rgba(255,255,255,0.05)]', tabInactive: 'text-zinc-600 hover:bg-zinc-900', 
        keypadBg: 'bg-black', totalBarBg: 'bg-zinc-950', menuBg: 'bg-black', 
        itemBorder: 'border-zinc-900', menuItemHover: 'hover:bg-zinc-900', 
        menuItemActive: 'bg-zinc-900 text-white', activeLineBg: 'bg-zinc-900/50 ring-1 ring-zinc-800',
        displayBorder: 'border-zinc-800'
    }
};

const BtnLabel: React.FC<{ text: string }> = ({ text }) => 
    <span className="text-[10px] font-bold uppercase tracking-wider">{text}</span>;

interface HistoryState {
    pages: BillItem[][];
    pageIdx: number;
    currentInput: string;
    activeItemId: number | null;
}

const App = () => {
    // --- State ---
    const [pages, setPages] = useState<BillItem[][]>(Array.from({ length: 4 }, () => [])); 
    const [currentPage, setCurrentPage] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null); 
    const [, setUserId] = useState<string | null>(null);
    
    // Global Logs (History Page)
    const [calculationLog, setCalculationLog] = useState<BillItem[]>([]);

    // History State (Undo/Redo for Calculator Pages)
    const [history, setHistory] = useState<HistoryState[]>([]);

    // Modes & Settings
    const [isGstMode, setIsGstMode] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeName>('light');
    const [taxRate, ] = useState(18); 
    const [availableRates, setAvailableRates] = useState([5, 18, 40]); 
    const [decimalConfig, ] = useState<DecimalConfig>(2); 
    const [numberFormat, setNumberFormat] = useState<NumberFormat>('IN'); 
    const [showLabels, setShowLabels] = useState(true);

    // UI State
    const [isKeypadExpanded, setIsKeypadExpanded] = useState(true);
    
    // Modal State
    const [showTaxModal, setShowTaxModal] = useState(false);
    const [tempRates, setTempRates] = useState<string[]>(['', '', '']);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number | null>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    
    // Derived Values
    const isCalculatorPage = currentPage < 2;
    const billItems = pages[currentPage] || [];
    const livePreview = currentInput ? evaluateExpression(currentInput) : 0;
    const grandTotal = billItems.reduce((sum, item) => sum + item.result, 0) + (activeItemId === null ? livePreview : 0);
    const emptyLines = Math.max(0, 3 - billItems.length - (activeItemId === null ? 1 : 0)); 
    
    const themeColors = THEME_COLORS[themeMode];

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
        if (isCalculatorPage && activeItemId === null) listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (isCalculatorPage && inputRef.current) inputRef.current.focus();
    }, [billItems.length, currentPage, activeItemId, isCalculatorPage]);
    
    useEffect(() => {
        if (currentPage === 2) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentPage, calculationLog.length]);

    useLayoutEffect(() => {
        if (cursorPositionRef.current !== null && inputRef.current) {
            inputRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
            cursorPositionRef.current = null; 
        }
    });

    // --- Helpers ---
    const addToLog = (item: BillItem) => {
        setCalculationLog(prev => [...prev, { ...item, id: Date.now() + Math.random() }]);
    };

    // --- History Management (Restore) ---
    // Snapshots capture the entire state of the calculator (pages, input, active item)
    // allowing recovery of digits, cleared lines, or cleared pages.
    const saveSnapshot = () => {
        const currentState: HistoryState = {
            pages: pages,
            pageIdx: currentPage,
            currentInput: currentInput,
            activeItemId: activeItemId
        };
        
        setHistory(prev => {
            const newHistory = [...prev, currentState];
            // Limit history stack size
            if (newHistory.length > 50) return newHistory.slice(1);
            return newHistory;
        });
    };

    const handleRestore = () => {
        if (history.length > 0) {
            triggerHaptic();
            const prevState = history[history.length - 1];
            const newHistory = history.slice(0, -1);
            setPages(prevState.pages);
            // Only switch page if necessary to avoid jarring jumps
            if (prevState.pageIdx !== currentPage) {
                 handlePageSwitch(prevState.pageIdx, false);
            }
            setCurrentInput(prevState.currentInput);
            setActiveItemId(prevState.activeItemId);
            cursorPositionRef.current = prevState.currentInput.length;
            setHistory(newHistory);
        }
    };

    // --- Handlers ---
    const handlePageSwitch = (idx: number, clearInput = true) => {
        setCurrentPage(idx);
        if (idx === 0) setIsGstMode(false); 
        if (idx === 1) setIsGstMode(true);  
        
        if (clearInput) {
            setActiveItemId(null);
            setCurrentInput('');
        }
    };

    const updateCurrentPageItems = (newItems: BillItem[]) => {
        const newPages = [...pages];
        newPages[currentPage] = newItems;
        setPages(newPages);
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
        // Clear history on constructive input to prevent restoring old state and overwriting new input
        setHistory([]); 
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
        if (isCalculatorPage) {
            setActiveItemId(item.id);
            setCurrentInput(item.expression); 
            cursorPositionRef.current = item.expression.length;
            setIsKeypadExpanded(true); 
        } else if (currentPage === 2) {
             triggerHaptic();
             copyToClipboard(formatNumber(item.result, decimalConfig, numberFormat));
        }
    };

    const handleTaxCalculation = (isAdd: boolean, rateOverride?: number) => {
        saveSnapshot(); 

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
            details: { base: baseVal, rate: rateToUse, taxAmt: taxAmount },
            timestamp: Date.now()
        };

        addToLog(newItem); 
        updateCurrentPageItems([...billItems, newItem]);
        setCurrentInput(''); 
        cursorPositionRef.current = 0;
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                // Don't save snapshot on paste, as it's constructive.
                // insertAtCursor will handle clearing history.
                const sanitized = text.replace(/[^0-9.+\-*/()%]/g, '');
                if (sanitized) insertAtCursor(sanitized);
            }
        } catch (e) { console.error(e); }
    };

    const handleInput = (value: string) => {
        if (inputRef.current && isCalculatorPage) inputRef.current.focus();

        switch(value) {
            case 'CLEAR_ALL': 
                saveSnapshot(); // Recover page
                updateCurrentPageItems([]); 
                setCurrentInput(''); 
                setActiveItemId(null); 
                break;
            case 'CLEAR_LINE': 
                saveSnapshot(); // Recover line
                if (currentInput) {
                    updateInput('', 0); 
                } else if (billItems.length > 0) {
                    updateCurrentPageItems(billItems.slice(0, -1));
                }
                break;
            case 'DELETE': 
                if (currentInput.length > 0) saveSnapshot(); // Recover digit
                deleteAtCursor(); 
                break;
            case 'NEXT_LINE':
                if (activeItemId !== null) {
                    saveSnapshot(); 
                    setActiveItemId(null); setCurrentInput(''); cursorPositionRef.current = 0;
                } else if (currentInput) {
                    saveSnapshot(); 
                    const result = evaluateExpression(currentInput);
                    const newItem: BillItem = { id: Date.now(), expression: currentInput, result, timestamp: Date.now() };
                    addToLog(newItem); 
                    updateCurrentPageItems([...billItems, newItem]);
                    setCurrentInput(''); cursorPositionRef.current = 0;
                }
                break;
            case '()':
                const openCount = (currentInput.match(/\(/g) || []).length;
                const closeCount = (currentInput.match(/\)/g) || []).length;
                const lastChar = currentInput.slice(-1);
                insertAtCursor((openCount > closeCount && !['(', '+', '-', 'x', '÷'].includes(lastChar)) ? ')' : (/\d|\)/.test(lastChar) ? 'x(' : '('));
                break;
            default: insertAtCursor(value);
        }
    };

    // Modal Helpers
    const openTaxModal = () => {
        setTempRates(availableRates.map(r => r.toString()));
        setShowTaxModal(true);
    };

    const saveRates = () => {
        const newRates = tempRates.map(r => parseFloat(r) || 0);
        // Ensure strictly 3 rates logic if needed, but array map preserves length
        setAvailableRates(newRates);
        setShowTaxModal(false);
    };

    const TabButton: React.FC<{ idx: number, label?: string, icon?: React.ElementType }> = ({ idx, label, icon: Icon }) => {
        const style = PAGE_STYLES[idx % PAGE_STYLES.length];
        const isActive = currentPage === idx;
        
        return (
            <button
                onClick={() => {
                    triggerHaptic();
                    handlePageSwitch(idx);
                }}
                className={`flex items-center justify-center w-full h-9 rounded-lg transition-all duration-200 font-bold text-sm ${
                    isActive
                    ? `${themeMode === 'dark' ? `${style.darkBg} ${style.darkText} border-transparent` : `${style.bg} ${style.text} border-transparent`} shadow-sm scale-105 border` 
                    : `${themeColors.tabInactive} ${themeMode === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'} border`
                }`}
            >
                {label ? label : (Icon && <Icon size={18} />)}
            </button>
        );
    };

    // Use <button> instead of <div> for better accessibility and touch handling
    const SettingRow: React.FC<{ label: string, value: string, icon: React.ElementType, onClick: () => void }> = ({ label, value, icon: Icon, onClick }) => {
        const valBg = themeMode === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-zinc-800 text-zinc-300';
        return (
            <button 
                onClick={() => { triggerHaptic(); onClick(); }}
                className={`w-full flex justify-between items-center border-b ${themeColors.itemBorder} py-3 px-4 active:opacity-50 transition-opacity text-left outline-none`}
            >
                <div className="flex items-center gap-3">
                    <Icon size={20} className={themeColors.subText} />
                    <span className={`${themeColors.text} font-medium`}>{label}</span>
                </div>
                <span className={`${valBg} font-bold opacity-100 px-2 py-1 rounded text-xs`}>{value}</span>
            </button>
        );
    };

    return (
        <div className={`w-full h-[100dvh] ${themeColors.appBg} overflow-hidden flex flex-col relative transition-colors duration-300`}>
            {/* --- Main Content --- */}
            <div className={`flex-1 flex flex-col overflow-hidden relative`}>
                <div className={`flex flex-col flex-1 overflow-hidden`}>
                    
                    {/* Tab Navigation */}
                    <div className={`grid grid-cols-4 gap-2 p-2 border-b ${themeColors.border} ${themeColors.headerBg} min-h-[52px]`}>
                        <TabButton idx={0} label="MASTER" />
                        <TabButton idx={1} label="GST" />
                        <TabButton idx={2} icon={History} />
                        <TabButton idx={3} icon={Settings} />
                    </div>

                    {/* Content Area */}
                    <div className={`flex-1 overflow-y-auto px-2 pb-2 pt-0 space-y-0 flex flex-col no-scrollbar relative`}>
                        
                        {/* Calculator Pages */}
                        {isCalculatorPage && (
                            <>
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
                            </>
                        )}

                        {/* History Page */}
                        {currentPage === 2 && (
                            <div className="flex flex-col min-h-full">
                                {calculationLog.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2 opacity-50 mt-20">
                                        <History size={48} />
                                        <span className="text-sm font-medium">Log Empty</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col pb-2">
                                        {/* Removed Subheading here as requested */}
                                        {calculationLog.map((item, index) => (
                                            <CommittedLine 
                                                key={item.id + '_' + index} 
                                                item={item} 
                                                onClick={handleLineClick} 
                                                themeColors={themeColors} 
                                                mode={item.mode} 
                                                decimalConfig={decimalConfig} 
                                                numberFormat={numberFormat} 
                                            />
                                        ))}
                                        <div ref={logEndRef} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Settings Page */}
                        {currentPage === 3 && (
                            <div className="flex flex-col pt-2">
                                <SettingRow 
                                    label="Theme" 
                                    value={themeMode === 'light' ? 'Light' : 'Dark'} 
                                    icon={themeMode === 'light' ? Sun : Moon}
                                    onClick={() => setThemeMode(prev => prev === 'light' ? 'dark' : 'light')} 
                                />
                                <SettingRow 
                                    label="Number System" 
                                    value={numberFormat === 'IN' ? 'Indian (Lakhs)' : 'International (Millions)'} 
                                    icon={Globe}
                                    onClick={() => setNumberFormat(prev => prev === 'IN' ? 'INTL' : 'IN')} 
                                />
                                <SettingRow 
                                    label="Button Labels" 
                                    value={showLabels ? 'Show' : 'Hide'} 
                                    icon={Tag}
                                    onClick={() => setShowLabels(!showLabels)} 
                                />
                                <SettingRow 
                                    label="Default Tax Rates"
                                    value={`${availableRates.join('%, ')}%`}
                                    icon={Percent}
                                    onClick={openTaxModal}
                                />

                                <div className={`px-4 mt-8 text-[10px] ${themeColors.subText} text-center opacity-40`}>
                                    GANAKA v1.1.0
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Total Bar with Floating Toggle - Only show on calculator pages */}
                    {isCalculatorPage && (
                        <div className={`relative flex items-center justify-between py-1.5 px-4 border-t ${themeColors.border} ${themeColors.totalBarBg} z-10`}>
                            <button 
                                onClick={() => {
                                    triggerHaptic();
                                    setIsKeypadExpanded(!isKeypadExpanded);
                                }}
                                className={`absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-6 flex items-center justify-center 
                                            ${themeMode === 'dark' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-slate-400 border-slate-100'} 
                                            border border-b-0 rounded-t-lg shadow-sm transition-colors z-20`}
                                aria-label={isKeypadExpanded ? "Minimize keypad" : "Expand keypad"}
                            >
                                {isKeypadExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
                            </button>
                            <span className={`text-xl font-bold uppercase tracking-wider ${themeColors.subText}`}>TOTAL =</span>
                            <button 
                                onClick={() => {
                                    triggerHaptic();
                                    copyToClipboard(formatNumber(grandTotal, decimalConfig, numberFormat));
                                }}
                                className={`text-2xl font-bold ${themeColors.text} active:scale-95 transition-transform`}
                            >
                                {formatNumber(grandTotal, decimalConfig, numberFormat)}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Tax Rate Modal */}
            {showTaxModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`${themeMode === 'light' ? 'bg-white' : 'bg-zinc-900 border border-zinc-800'} w-full max-w-xs rounded-2xl p-5 shadow-2xl`}>
                        <h3 className={`text-lg font-bold mb-4 ${themeColors.text}`}>Edit Tax Rates</h3>
                        <div className="flex gap-2 mb-6">
                            {tempRates.map((rate, i) => (
                                <div key={i} className="flex-1">
                                    <label className={`text-[10px] font-bold uppercase ${themeColors.subText} mb-1.5 block text-center`}>Slot {i+1} (%)</label>
                                    <input 
                                        type="number" 
                                        inputMode="numeric"
                                        value={rate} 
                                        onChange={e => {
                                            const n = [...tempRates];
                                            n[i] = e.target.value;
                                            setTempRates(n);
                                        }}
                                        className={`w-full p-2.5 rounded-xl text-center font-bold text-xl outline-none transition-all
                                            ${themeMode === 'light' ? 'bg-slate-100 text-slate-900 focus:ring-2 ring-slate-200' : 'bg-zinc-950 text-zinc-100 focus:ring-2 ring-zinc-700'}
                                        `}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowTaxModal(false)} 
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${themeMode === 'light' ? 'bg-slate-100 text-slate-600 active:bg-slate-200' : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'}`}
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={saveRates} 
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                            >
                                SAVE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Keypad --- */}
            {isKeypadExpanded && isCalculatorPage && (
                <div className={`${themeColors.keypadBg} flex flex-col border-t ${themeColors.border} transition-colors duration-300`}>
                    <div className="p-3 pt-3 grid grid-cols-4 gap-2 pb-6 animate-in slide-in-from-bottom-2 duration-200">
                        {/* Row 1 */}
                        <Button icon={RefreshCw} label={showLabels ? <BtnLabel text="RESET" /> : undefined} onClick={() => handleInput('CLEAR_ALL')} className="bg-rose-300 text-black active:bg-rose-400" />
                        <Button icon={ChevronsLeft} label={showLabels ? <BtnLabel text="CLEAR" /> : undefined} onClick={() => handleInput('CLEAR_LINE')} className="bg-orange-200 text-black active:bg-orange-300" />
                        <Button icon={ChevronLeft} label={showLabels ? <BtnLabel text="DELETE" /> : undefined} onClick={() => handleInput('DELETE')} className="bg-amber-200 text-black active:bg-amber-300" />
                        <Button icon={CornerDownLeft} label={showLabels ? <BtnLabel text="ENTER" /> : undefined} onClick={() => handleInput('NEXT_LINE')} className="bg-emerald-300 text-black active:bg-emerald-400" />

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
                                        className="flex-1 bg-rose-200 rounded-lg text-black font-bold text-sm shadow-sm active:scale-95 active:bg-rose-200 active:text-rose-900 bg-rose-100 flex items-center justify-center"
                                    >
                                        -{rate}%
                                    </button>
                                </div>
                            ))
                        ) : (
                            <>
                                <Button icon={Parentheses} onClick={() => handleInput('()')} className="bg-violet-200 text-black active:bg-violet-300 font-bold" />
                                
                                <Button 
                                    icon={RotateCcw}
                                    label={showLabels ? <BtnLabel text="RESTORE" /> : undefined}
                                    onClick={handleRestore} 
                                    className={`bg-slate-200 text-black active:bg-slate-300 font-bold ${history.length === 0 ? 'opacity-40' : ''}`} 
                                />

                                <Button icon={Clipboard} label={showLabels ? <BtnLabel text="PASTE" /> : undefined} onClick={handlePaste} className="bg-lime-200 text-black active:bg-lime-300 font-bold" />
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
                            label={<span className="font-black text-xs tracking-widest text-gray-400">GANAKA</span>} 
                            onClick={() => {}} 
                            className="bg-gray-50 border border-gray-100 shadow-none pointer-events-none" 
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