import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
    RotateCcw, ChevronsLeft, ChevronLeft, CornerDownLeft, X, Palette, Percent, 
    Check, Edit2, Trash2, Plus, Settings, Sun, Moon, Smartphone, Monitor, ArrowLeft, 
    ChevronRight, Info, Github, Hash, Layers, Globe, Tag
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

import { Button } from './components/Button';
import { ThemeOption } from './components/ThemeOption';
import { ActiveLine } from './components/ActiveLine';
import { CommittedLine } from './components/CommittedLine';
import { formatNumber, evaluateExpression, triggerHaptic } from './utils';
import { BillItem, ThemeColors, ThemeName, DecimalConfig, NumberFormat } from './types';

// --- Configuration & Globals ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Distinct colors for each page to help distinguish them visually
const PAGE_COLORS = [
    'text-blue-600 dark:text-blue-400',
    'text-emerald-600 dark:text-emerald-400',
    'text-violet-600 dark:text-violet-400',
    'text-amber-600 dark:text-amber-400',
    'text-rose-600 dark:text-rose-400',
    'text-cyan-600 dark:text-cyan-400',
    'text-fuchsia-600 dark:text-fuchsia-400',
    'text-lime-600 dark:text-lime-400',
    'text-indigo-600 dark:text-indigo-400',
];

const App = () => {
    // Start with 3 pages by default
    const [pages, setPages] = useState<BillItem[][]>([[], [], []]); 
    const [currentPage, setCurrentPage] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null); 
    const [userId, setUserId] = useState<string | null>(null);

    // Default rates: 5, 18, 40
    const [taxRate, setTaxRate] = useState(18); 
    const [availableRates, setAvailableRates] = useState([5, 18, 40]); 
    
    const [theme, setTheme] = useState<string>('system'); 
    const [systemTheme, setSystemTheme] = useState<ThemeName>('light');
    const [decimalConfig, setDecimalConfig] = useState<DecimalConfig>('auto');
    const [numberFormat, setNumberFormat] = useState<NumberFormat>('NONE');
    const [showLabels, setShowLabels] = useState(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState('main'); 
    
    // Settings menu state for Tax Rates
    const [editingRateIndex, setEditingRateIndex] = useState<number | null>(null);
    const [newRateInput, setNewRateInput] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number | null>(null);
    const editRateInputRef = useRef<HTMLInputElement>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    
    // Touch handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const billItems = pages[currentPage] || [];
    const livePreview = currentInput ? evaluateExpression(currentInput) : 0;
    const grandTotal = billItems.reduce((sum, item) => sum + item.result, 0) + (activeItemId === null ? livePreview : 0);
    const emptyLines = Math.max(0, 3 - billItems.length - (activeItemId === null ? 1 : 0)); 
    
    const currentPageColor = PAGE_COLORS[currentPage % PAGE_COLORS.length];

    useEffect(() => {
        try {
            // Check if config exists to avoid crash in simpler environments
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
        } catch (e) { console.error("Firebase Init Error (Ignorable in development):", e); }
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
        const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
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

    useEffect(() => {
        if (!isMenuOpen) {
            setTimeout(() => {
                setMenuView('main');
                setEditingRateIndex(null);
                setNewRateInput('');
            }, 200);
        }
    }, [isMenuOpen]);

    const updateCurrentPageItems = (newItems: BillItem[]) => {
        setPages(prev => {
            const newPages = [...prev];
            newPages[currentPage] = newItems;
            return newPages;
        });
    };
    
    const setPageCount = (count: number) => {
        if (count < 1) return;
        setPages(prev => {
            if (count > prev.length) {
                return [...prev, ...Array(count - prev.length).fill(null).map(() => [])];
            } else {
                return prev.slice(0, count);
            }
        });
        if (currentPage >= count) {
            setCurrentPage(count - 1);
        }
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
        // Haptic is handled in CommittedLine component
        setActiveItemId(item.id);
        setCurrentInput(item.expression); 
        cursorPositionRef.current = item.expression.length;
    };

    const handleTaxCalculation = (isAdd: boolean) => {
        const baseVal = evaluateExpression(currentInput);
        if (baseVal === 0 && currentInput === '') return;
        
        const rateDecimal = taxRate / 100;
        let finalVal, taxAmount;

        if (isAdd) {
            finalVal = baseVal * (1 + rateDecimal);
            taxAmount = finalVal - baseVal;
        } else {
            finalVal = baseVal / (1 + rateDecimal);
            taxAmount = baseVal - finalVal;
        }

        const newItem: BillItem = {
            id: Date.now(),
            expression: currentInput, 
            result: finalVal,         
            mode: 'GST',
            type: isAdd ? 'add' : 'remove',
            rate: taxRate,
            details: { base: baseVal, rate: taxRate, taxAmt: taxAmount }
        };

        updateCurrentPageItems([...billItems, newItem]);
        setCurrentInput(''); 
        cursorPositionRef.current = 0;
    };

    const handleInput = (value: string) => {
        // Haptic is handled in Button component which calls this
        if (inputRef.current) inputRef.current.focus();

        switch(value) {
            case 'CLEAR_ALL': updateCurrentPageItems([]); setCurrentInput(''); setActiveItemId(null); break;
            case 'CLEAR_LINE': updateInput('', 0); break;
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
                insertAtCursor((openCount > closeCount && !['(', '+', '-', 'x', '÷'].includes(lastChar)) ? ')' : (/\d|\)/.test(lastChar) ? 'x(' : '('));
                break;
            case 'TAX+': handleTaxCalculation(true); break;
            case 'TAX-': handleTaxCalculation(false); break;
            default: insertAtCursor(value);
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50 && currentPage < pages.length - 1) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c + 1); 
        }
        else if (distance < -50 && currentPage > 0) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c - 1); 
        }
    };

    const handleTaxButtonClick = () => {
        triggerHaptic();
        if (availableRates.length === 0) return;
        
        const currentIndex = availableRates.indexOf(taxRate);
        // If current rate is not in list (e.g. was deleted), default to first.
        // Otherwise cycle to next.
        const nextIndex = (currentIndex + 1) % availableRates.length;
        setTaxRate(availableRates[nextIndex]);
    };

    const handleSaveEditedRate = (index: number) => {
        triggerHaptic();
        if (!editRateInputRef.current) return;
        const val = parseFloat(editRateInputRef.current.value);
        if (!isNaN(val) && val >= 0) {
            const newRates = [...availableRates];
            newRates[index] = val;
            setAvailableRates(newRates.sort((a, b) => a - b));
            if (availableRates[index] === taxRate) setTaxRate(val);
        }
        setEditingRateIndex(null);
    };
    
    const handleAddRate = () => {
        triggerHaptic();
        const val = parseFloat(newRateInput);
        if (!isNaN(val) && val >= 0 && !availableRates.includes(val)) {
            setAvailableRates([...availableRates, val].sort((a, b) => a - b));
            setNewRateInput('');
        }
    };
    
    const handleDeleteRate = (index: number) => {
        triggerHaptic();
        if (availableRates.length <= 1) return;
        const rateToDelete = availableRates[index];
        const newRates = availableRates.filter((_, i) => i !== index);
        setAvailableRates(newRates);
        if (taxRate === rateToDelete) setTaxRate(newRates[0]);
    };

    const activeThemeName: ThemeName = theme === 'system' ? systemTheme : (theme as ThemeName);
    
    const themeColors: ThemeColors = {
        light: { bg: 'bg-gray-200', appBg: 'bg-white', text: 'text-gray-800', subText: 'text-gray-500', border: 'border-gray-200', headerBg: 'bg-white', tabBg: 'bg-gray-50', tabActive: 'bg-white text-indigo-600', tabInactive: 'text-gray-400 hover:bg-gray-100', keypadBg: 'bg-gray-50', totalBarBg: 'bg-white', menuBg: 'bg-white', itemBorder: 'border-gray-300', menuItemHover: 'hover:bg-gray-50', menuItemActive: 'bg-indigo-50 text-indigo-700', activeLineBg: 'bg-yellow-50/50 ring-1 ring-blue-100' },
        dark: { bg: 'bg-gray-900', appBg: 'bg-slate-800', text: 'text-gray-100', subText: 'text-gray-400', border: 'border-slate-700', headerBg: 'bg-slate-800', tabBg: 'bg-slate-900', tabActive: 'bg-slate-800 text-indigo-400', tabInactive: 'text-slate-500 hover:bg-slate-700', keypadBg: 'bg-slate-900', totalBarBg: 'bg-slate-800', menuBg: 'bg-slate-800', itemBorder: 'border-slate-600', menuItemHover: 'hover:bg-slate-700', menuItemActive: 'bg-slate-700 text-indigo-400', activeLineBg: 'bg-slate-700/50 ring-1 ring-indigo-500/50' },
        black: { bg: 'bg-black', appBg: 'bg-black', text: 'text-gray-200', subText: 'text-gray-500', border: 'border-gray-800', headerBg: 'bg-black', tabBg: 'bg-black', tabActive: 'bg-black text-indigo-500 border-t-2 border-indigo-500', tabInactive: 'text-gray-600 hover:text-gray-400', keypadBg: 'bg-black', totalBarBg: 'bg-black', menuBg: 'bg-black', itemBorder: 'border-gray-800', menuItemHover: 'hover:bg-gray-900', menuItemActive: 'bg-gray-900 text-indigo-500', activeLineBg: 'bg-gray-900 ring-1 ring-gray-700' },
        system: { bg: 'bg-gray-200', appBg: 'bg-white', text: 'text-gray-800', subText: 'text-gray-500', border: 'border-gray-200', headerBg: 'bg-white', tabBg: 'bg-gray-50', tabActive: 'bg-white text-indigo-600', tabInactive: 'text-gray-400 hover:bg-gray-100', keypadBg: 'bg-gray-50', totalBarBg: 'bg-white', menuBg: 'bg-white', itemBorder: 'border-gray-300', menuItemHover: 'hover:bg-gray-50', menuItemActive: 'bg-indigo-50 text-indigo-700', activeLineBg: 'bg-yellow-50/50 ring-1 ring-blue-100' } // Fallback
    }[activeThemeName];

    // Helper to render labels inside icon buttons if setting is enabled
    const LabelText = ({ text }: { text: string }) => showLabels ? <span className="text-[10px] font-bold mt-0.5 leading-none">{text}</span> : null;

    return (
        <div className={`min-h-screen flex items-center justify-center sm:p-4 font-sans transition-colors duration-300 ${themeColors.bg}`}>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            
            <div className={`w-full max-w-[412px] ${themeColors.appBg} sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-screen sm:h-[850px] relative border sm:border-[4px] ${themeColors.border} transition-colors duration-300`}>
                
                {isMenuOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { triggerHaptic(); setIsMenuOpen(false); }} />
                        <div className={`relative w-[90%] max-w-sm max-h-[80vh] rounded-2xl shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in duration-200 ${themeColors.menuBg} ${themeColors.text}`}>
                            <div className="flex justify-center items-center mb-6 relative">
                                <h2 className="text-2xl font-bold">GANAKA</h2>
                                <button onClick={() => { triggerHaptic(); setIsMenuOpen(false); }} className="absolute right-0 p-2 rounded-full hover:opacity-80 outline-none"><X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {menuView === 'main' && (
                                    <div className="space-y-2">
                                        <button onClick={() => { triggerHaptic(); setMenuView('themes'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Palette size={22} /> Themes</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('pages'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Layers size={22} /> Pages</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('taxRates'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Percent size={22} /> Tax Rates</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('formatting'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Globe size={22} /> Number System</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('decimals'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Hash size={22} /> Decimal Places</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('display'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Tag size={22} /> Display</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('about'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Info size={22} /> About</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                    </div>
                                )}
                                {menuView === 'themes' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Select Theme</h3>
                                        <div className="space-y-3">
                                            {['light', 'dark', 'black', 'system'].map(t => (
                                                <ThemeOption key={t} id={t} label={t.charAt(0).toUpperCase() + t.slice(1) + (t==='black' ? ' (OLED)' : '')} icon={t==='light'?Sun:t==='dark'?Moon:t==='black'?Smartphone:Monitor} currentTheme={theme} setTheme={setTheme} themeColors={themeColors} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {menuView === 'pages' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Number of Pages</h3>
                                        <p className={`text-sm opacity-70 ${themeColors.subText} mb-4`}>Select the number of active pages.</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {Array.from({ length: 9 }, (_, i) => i + 1).map(num => (
                                                 <button 
                                                 key={num} 
                                                 onClick={() => { triggerHaptic(); setPageCount(num); }} 
                                                 className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all outline-none ${
                                                     pages.length === num
                                                     ? themeColors.menuItemActive + ' border-transparent font-bold' 
                                                     : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover
                                                 }`}
                                             >
                                                {num}
                                             </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {menuView === 'taxRates' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Manage Tax Rates</h3>
                                        <div className="space-y-3 mb-6">
                                            {availableRates.map((rate, index) => (
                                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${themeColors.itemBorder} ${themeColors.menuItemHover}`}>
                                                    {editingRateIndex === index ? (
                                                        <input ref={editRateInputRef} type="number" autoFocus defaultValue={rate} onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedRate(index)} className={`w-20 p-1 bg-transparent border-b-2 border-indigo-500 outline-none font-bold text-lg ${themeColors.text}`} />
                                                    ) : <span className="font-bold text-lg">{rate}%</span>}
                                                    <div className="flex items-center gap-2">
                                                        {editingRateIndex === index ? (
                                                            <button onClick={() => handleSaveEditedRate(index)} className="p-2 text-green-500 hover:bg-green-50 rounded-full outline-none"><Check size={18}/></button>
                                                        ) : <button onClick={() => { triggerHaptic(); setEditingRateIndex(index); }} className={`p-2 hover:opacity-70 rounded-full outline-none ${themeColors.text}`}><Edit2 size={16}/></button>}
                                                        <button onClick={() => handleDeleteRate(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full outline-none"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`p-4 rounded-xl border-2 border-dashed ${themeColors.itemBorder} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="number" value={newRateInput} onChange={(e) => setNewRateInput(e.target.value)} placeholder="Add Rate %" className={`flex-1 bg-transparent outline-none font-medium ${themeColors.text}`} onKeyDown={(e) => e.key === 'Enter' && handleAddRate()} />
                                                <button onClick={handleAddRate} disabled={!newRateInput} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 outline-none"><Plus size={20} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {menuView === 'formatting' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Number System</h3>
                                        <p className={`text-sm opacity-70 ${themeColors.subText} mb-4`}>Select how numbers are formatted.</p>
                                        <div className="space-y-3">
                                            {([
                                                { id: 'IN', label: 'Indian', desc: 'Lakhs & Crores (1,23,456.78)' },
                                                { id: 'INTL', label: 'International', desc: 'Millions (123,456.78)' },
                                                { id: 'NONE', label: 'None', desc: 'Raw number (123456.78)' }
                                            ] as const).map(opt => (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => { triggerHaptic(); setNumberFormat(opt.id); }} 
                                                    className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all outline-none ${
                                                        numberFormat === opt.id 
                                                        ? themeColors.menuItemActive + ' border-transparent' 
                                                        : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-semibold text-lg">{opt.label}</span>
                                                        <span className="text-xs opacity-60">{opt.desc}</span>
                                                    </div>
                                                    {numberFormat === opt.id && <Check size={20} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {menuView === 'decimals' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Decimal Precision</h3>
                                        <p className={`text-sm opacity-70 ${themeColors.subText} mb-4`}>Select the number of decimal places to display in calculations.</p>
                                        <div className="space-y-3">
                                            {([
                                                { id: 'auto', label: 'Auto (Default)', desc: 'No trailing zeros' },
                                                { id: 0, label: '0', desc: 'Integers only' },
                                                { id: 2, label: '2', desc: 'Standard (0.00)' },
                                                { id: 3, label: '3', desc: 'High precision (0.000)' },
                                                { id: 4, label: '4', desc: 'Extra precision' }
                                            ] as const).map(opt => (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => { triggerHaptic(); setDecimalConfig(opt.id); }} 
                                                    className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all outline-none ${
                                                        decimalConfig === opt.id 
                                                        ? themeColors.menuItemActive + ' border-transparent' 
                                                        : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-semibold text-lg">{opt.label}</span>
                                                        <span className="text-xs opacity-60">{opt.desc}</span>
                                                    </div>
                                                    {decimalConfig === opt.id && <Check size={20} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {menuView === 'display' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Display Settings</h3>
                                        <div className="space-y-3">
                                            <button 
                                                onClick={() => { triggerHaptic(); setShowLabels(!showLabels); }} 
                                                className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all outline-none ${
                                                    showLabels
                                                    ? themeColors.menuItemActive + ' border-transparent' 
                                                    : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover
                                                }`}
                                            >
                                                <div className="flex flex-col items-start">
                                                    <span className="font-semibold text-lg">Button Labels</span>
                                                    <span className="text-xs opacity-60">Show text labels on icon buttons</span>
                                                </div>
                                                {showLabels && <Check size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {menuView === 'about' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 outline-none ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>About</h3>
                                        <div className="flex flex-col items-center text-center space-y-4 py-8">
                                            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">G</div>
                                            <h2 className="text-2xl font-bold">GANAKA</h2>
                                            <p className={`opacity-70 ${themeColors.subText}`}>
                                                A powerful, intuitive calculator designed for rapid GST calculations and multi-page management.
                                            </p>
                                            <div className="pt-6 w-full">
                                                <a href="https://github.com/" target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 p-4 rounded-xl w-full font-bold transition-colors border ${themeColors.border} ${themeColors.menuItemHover}`}>
                                                    <Github size={20} />
                                                    Visit GitHub
                                                </a>
                                            </div>
                                            <p className="text-xs opacity-40 pt-8">Version 1.6.0</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`mt-auto pt-6 border-t ${themeColors.border}`}><p className="text-xs text-center opacity-50">Designed with ❤️</p></div>
                        </div>
                    </div>
                )}

                <div className={`flex-1 flex flex-col overflow-hidden relative transition-colors duration-300`}>
                    <div className={`flex-1 overflow-y-auto px-4 pb-4 pt-0 space-y-0 border-b ${themeColors.border} flex flex-col no-scrollbar`} 
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
                    
                    <div className={`${themeColors.totalBarBg} ${themeColors.text} border-t ${themeColors.border} py-1.5 px-3 z-10 shadow-md transition-colors duration-300`}>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-1 flex items-center justify-between">
                                <button 
                                    onClick={() => { if (currentPage > 0) { triggerHaptic(); setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c - 1); }}}
                                    disabled={currentPage === 0}
                                    className={`p-1 rounded-full ${currentPage === 0 ? 'opacity-20' : 'opacity-70 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700'} outline-none`}
                                >
                                    <ChevronLeft size={20} strokeWidth={2.5} />
                                </button>
                                <span className="text-lg font-bold w-4 text-center">{currentPage + 1}</span>
                                <button 
                                    onClick={() => { if (currentPage < pages.length - 1) { triggerHaptic(); setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c + 1); }}}
                                    disabled={currentPage === pages.length - 1}
                                    className={`p-1 rounded-full ${currentPage === pages.length - 1 ? 'opacity-20' : 'opacity-70 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700'} outline-none`}
                                >
                                    <ChevronRight size={20} strokeWidth={2.5} />
                                </button>
                            </div>
                            <div className="col-span-3 flex items-center justify-between pl-2">
                                <span className={`text-xl font-bold uppercase tracking-wider opacity-100 ${currentPageColor}`}>TOTAL</span>
                                <span className={`text-2xl font-bold ${currentPageColor}`}>{formatNumber(grandTotal, decimalConfig, numberFormat)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${themeColors.keypadBg} p-3 grid grid-cols-4 gap-2 border-t ${themeColors.border} pb-6 transition-colors duration-300`}>
                    <Button icon={RotateCcw} label={<LabelText text="Clear" />} onClick={() => handleInput('CLEAR_ALL')} className="bg-stone-200 text-stone-700 hover:bg-stone-300 dark:bg-purple-800 dark:text-purple-100" />
                    <Button icon={ChevronsLeft} label={<LabelText text="Line" />} onClick={() => handleInput('CLEAR_LINE')} className="bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-blue-800 dark:text-blue-100" />
                    <Button icon={ChevronLeft} label={<LabelText text="Back" />} onClick={() => handleInput('DELETE')} className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-stone-600 dark:text-stone-100" />
                    <Button icon={CornerDownLeft} label={<LabelText text="Enter" />} onClick={() => handleInput('NEXT_LINE')} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-700 dark:text-indigo-100" />

                    <Button 
                        label={
                            <div className="flex flex-col items-center">
                                <div className="flex items-center justify-center gap-1">
                                    <ChevronLeft size={16} strokeWidth={3} className="opacity-40" />
                                    <span className="text-lg font-bold leading-none pt-0.5">{taxRate}%</span>
                                    <ChevronRight size={16} strokeWidth={3} className="opacity-40" />
                                </div>
                                <LabelText text="Rate" />
                            </div>
                        } 
                        onClick={handleTaxButtonClick} 
                        className="bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border-2 border-fuchsia-100 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-700 shadow-sm" 
                    />
                    <Button label={<div className="flex flex-col items-center"><span>GST+</span><LabelText text="Add" /></div>} onClick={() => handleInput('TAX+')} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-800 dark:text-emerald-100 text-sm font-bold" />
                    <Button label={<div className="flex flex-col items-center"><span>GST-</span><LabelText text="Sub" /></div>} onClick={() => handleInput('TAX-')} className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 text-sm font-bold" />

                    <Button label="%" onClick={() => handleInput('%')} className="bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-fuchsia-800 dark:text-fuchsia-100 font-bold" />
                    <Button label="7" onClick={() => handleInput('7')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="8" onClick={() => handleInput('8')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="9" onClick={() => handleInput('9')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="÷" onClick={() => handleInput('÷')} className="bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-lime-800 dark:text-lime-100 text-2xl" />
                    <Button label="4" onClick={() => handleInput('4')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="5" onClick={() => handleInput('5')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="6" onClick={() => handleInput('6')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="x" onClick={() => handleInput('x')} className="bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-yellow-700 dark:text-yellow-100 text-xl" />
                    <Button label="1" onClick={() => handleInput('1')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="2" onClick={() => handleInput('2')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="3" onClick={() => handleInput('3')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="-" onClick={() => handleInput('-')} className="bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-800 dark:text-sky-100 text-2xl" />
                    <Button icon={Settings} label={<LabelText text="Menu" />} onClick={() => { triggerHaptic(); setIsMenuOpen(true); }} className="bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 font-bold" />
                    <Button label="0" onClick={() => handleInput('0')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white" />
                    <Button label="." onClick={() => handleInput('.')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-900 dark:bg-slate-700 dark:text-white font-bold text-xl" />
                    <Button label="+" onClick={() => handleInput('+')} className="bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-teal-800 dark:text-teal-100 text-2xl" />
                </div>
            </div>
        </div>
    );
};

export default App;