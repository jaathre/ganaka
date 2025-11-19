import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
    RotateCcw, ChevronsLeft, ChevronLeft, CornerDownLeft, X, Palette, Percent, 
    Check, Edit2, Trash2, Plus, Settings, Sun, Moon, Smartphone, Monitor, ArrowLeft, 
    ChevronRight, Scissors, Copy, Clipboard 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

import { Button } from './components/Button';
import { ThemeOption } from './components/ThemeOption';
import { ModeToggle } from './components/ModeToggle';
import { ActiveLine } from './components/ActiveLine';
import { CommittedLine } from './components/CommittedLine';
import { formatNumber, evaluateExpression, copyToClipboard, triggerHaptic } from './utils';
import { BillItem, ThemeColors, ThemeName } from './types';

// --- Configuration & Globals ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const App = () => {
    const [pages, setPages] = useState<BillItem[][]>([[], [], [], []]); 
    const [currentPage, setCurrentPage] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null); 
    const [userId, setUserId] = useState<string | null>(null);

    const [taxRate, setTaxRate] = useState(18); 
    const [availableRates, setAvailableRates] = useState([5, 12, 18, 28]); 
    const [isGstMode, setIsGstMode] = useState(true);

    const [theme, setTheme] = useState<string>('light'); 
    const [systemTheme, setSystemTheme] = useState<ThemeName>('light');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState('main'); 
    const [isCustomTaxModalOpen, setIsCustomTaxModalOpen] = useState(false);
    const [tempCustomRate, setTempCustomRate] = useState('');
    const [editingRateIndex, setEditingRateIndex] = useState<number | null>(null);
    const [newRateInput, setNewRateInput] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number | null>(null);
    const editRateInputRef = useRef<HTMLInputElement>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressRef = useRef(false);
    const screenshotRef = useRef<HTMLDivElement>(null); 
    
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const billItems = pages[currentPage] || [];
    const livePreview = currentInput ? evaluateExpression(currentInput) : 0;
    const grandTotal = billItems.reduce((sum, item) => sum + item.result, 0) + (activeItemId === null ? livePreview : 0);
    const emptyLines = Math.max(0, 3 - billItems.length - (activeItemId === null ? 1 : 0)); 

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

    const updateCurrentPage = (newItems: BillItem[]) => {
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
            updateCurrentPage(updatedItems);
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
            mode: isGstMode ? 'GST' : 'TAX',
            type: isAdd ? 'add' : 'remove',
            rate: taxRate,
            details: { base: baseVal, rate: taxRate, taxAmt: taxAmount }
        };

        updateCurrentPage([...billItems, newItem]);
        setCurrentInput(''); 
        cursorPositionRef.current = 0;
    };

    const handleInput = (value: string) => {
        // Haptic is handled in Button component which calls this
        if (inputRef.current) inputRef.current.focus();

        switch(value) {
            case 'CLEAR_ALL': updateCurrentPage([]); setCurrentInput(''); setActiveItemId(null); break;
            case 'CLEAR_LINE': updateInput('', 0); break;
            case 'DELETE': deleteAtCursor(); break;
            case 'NEXT_LINE':
                if (activeItemId !== null) {
                    setActiveItemId(null); setCurrentInput(''); cursorPositionRef.current = 0;
                } else if (currentInput) {
                    const result = evaluateExpression(currentInput);
                    updateCurrentPage([...billItems, { id: Date.now(), expression: currentInput, result }]);
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

    const handleCopy = () => copyToClipboard(formatNumber(grandTotal));
    const handleCut = () => { handleCopy(); updateCurrentPage([]); setCurrentInput(''); setActiveItemId(null); };
    const handlePaste = async () => {
        if (inputRef.current) inputRef.current.focus();
        try {
            const text = await navigator.clipboard.readText();
            if (text && !isNaN(parseFloat(text))) insertAtCursor(text);
        } catch (err) { console.error(err); }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50 && currentPage < 3) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c + 1); 
        }
        else if (distance < -50 && currentPage > 0) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c - 1); 
        }
    };

    const handleTaxButtonClick = () => { 
        if (!isLongPressRef.current) { setTempCustomRate(taxRate.toString()); setIsCustomTaxModalOpen(true); }
        isLongPressRef.current = false;
    };
    const handleTaxButtonDown = () => {
        isLongPressRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            triggerHaptic(); // Haptic for long press activation
            setTempCustomRate(taxRate.toString());
            setIsCustomTaxModalOpen(true);
        }, 500);
    };
    const handleTaxButtonUp = () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };

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

    const getPageBackground = () => {
        if (activeThemeName === 'light') {
            const pageColors = ['bg-white', 'bg-red-50', 'bg-green-50', 'bg-blue-50'];
            return pageColors[currentPage] || 'bg-white';
        }
        return activeThemeName === 'black' ? 'bg-black' : 'bg-slate-800';
    };

    return (
        <div className={`min-h-screen flex items-center justify-center sm:p-4 font-sans transition-colors duration-300 ${themeColors.bg}`}>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            
            <div className={`w-full max-w-[412px] ${themeColors.appBg} sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-screen sm:h-[850px] relative border sm:border-[4px] ${themeColors.border} transition-colors duration-300`}>
                
                {isMenuOpen && (
                    <div className="absolute inset-0 z-50 flex">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { triggerHaptic(); setIsMenuOpen(false); }} />
                        <div className={`relative w-80 h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-left duration-200 ${themeColors.menuBg} ${themeColors.text}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">Menu</h2>
                                <button onClick={() => { triggerHaptic(); setIsMenuOpen(false); }} className="p-2 rounded-full hover:opacity-80"><X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {menuView === 'main' && (
                                    <div className="space-y-2">
                                        <button onClick={() => { triggerHaptic(); setMenuView('themes'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Palette size={22} /> Themes</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                        <button onClick={() => { triggerHaptic(); setMenuView('taxRates'); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><Percent size={22} /> Tax Rates</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                    </div>
                                )}
                                {menuView === 'themes' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Select Theme</h3>
                                        <div className="space-y-3">
                                            {['light', 'dark', 'black', 'system'].map(t => (
                                                <ThemeOption key={t} id={t} label={t.charAt(0).toUpperCase() + t.slice(1) + (t==='black' ? ' (OLED)' : '')} icon={t==='light'?Sun:t==='dark'?Moon:t==='black'?Smartphone:Monitor} currentTheme={theme} setTheme={setTheme} themeColors={themeColors} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {menuView === 'taxRates' && (
                                    <div className="space-y-4 animate-in slide-in-from-right duration-200">
                                        <button onClick={() => { triggerHaptic(); setMenuView('main'); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 opacity-70 hover:opacity-100 ${themeColors.text}`}><ArrowLeft size={16} /> Back</button>
                                        <h3 className={`text-xl font-bold mb-4 ${themeColors.text}`}>Manage Tax Rates</h3>
                                        <div className="space-y-3 mb-6">
                                            {availableRates.map((rate, index) => (
                                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${themeColors.itemBorder} ${themeColors.menuItemHover}`}>
                                                    {editingRateIndex === index ? (
                                                        <input ref={editRateInputRef} type="number" autoFocus defaultValue={rate} onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedRate(index)} className={`w-20 p-1 bg-transparent border-b-2 border-indigo-500 outline-none font-bold text-lg ${themeColors.text}`} />
                                                    ) : <span className="font-bold text-lg">{rate}%</span>}
                                                    <div className="flex items-center gap-2">
                                                        {editingRateIndex === index ? (
                                                            <button onClick={() => handleSaveEditedRate(index)} className="p-2 text-green-500 hover:bg-green-50 rounded-full"><Check size={18}/></button>
                                                        ) : <button onClick={() => { triggerHaptic(); setEditingRateIndex(index); }} className={`p-2 hover:opacity-70 rounded-full ${themeColors.text}`}><Edit2 size={16}/></button>}
                                                        <button onClick={() => handleDeleteRate(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`p-4 rounded-xl border-2 border-dashed ${themeColors.itemBorder} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="number" value={newRateInput} onChange={(e) => setNewRateInput(e.target.value)} placeholder="Add Rate %" className={`flex-1 bg-transparent outline-none font-medium ${themeColors.text}`} onKeyDown={(e) => e.key === 'Enter' && handleAddRate()} />
                                                <button onClick={handleAddRate} disabled={!newRateInput} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Plus size={20} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`mt-auto pt-6 border-t ${themeColors.border}`}><p className="text-xs text-center opacity-50">GANAKA v1.6</p></div>
                        </div>
                    </div>
                )}

                {isCustomTaxModalOpen && (
                    <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                        <div className={`${themeColors.appBg} ${themeColors.text} rounded-2xl p-6 w-full shadow-2xl animate-in fade-in zoom-in duration-200`}>
                            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Select {isGstMode ? 'GST' : 'Tax'} Rate</h3><button onClick={() => { triggerHaptic(); setIsCustomTaxModalOpen(false); }} className="opacity-60 hover:opacity-100"><X size={24} /></button></div>
                            <div className="grid grid-cols-4 gap-2 mb-6">
                                {availableRates.map(rate => (
                                    <button key={rate} onClick={() => { triggerHaptic(); setTaxRate(rate); setIsCustomTaxModalOpen(false); }} className={`p-3 rounded-xl font-bold border-2 transition-all ${taxRate === rate ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>{rate}%</button>
                                ))}
                            </div>
                            <div className="relative mb-6">
                                <input type="number" value={tempCustomRate} onChange={(e) => setTempCustomRate(e.target.value)} placeholder="Custom Rate" className={`w-full p-4 text-3xl font-bold border-2 rounded-xl outline-none text-center ${activeThemeName === 'light' ? 'border-indigo-100 focus:border-indigo-500 text-indigo-600' : 'bg-gray-700 border-gray-600 focus:border-indigo-400 text-white'}`} autoFocus />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xl">%</span>
                            </div>
                            <div className="space-y-3">
                                <button onClick={() => { triggerHaptic(); const r = parseFloat(tempCustomRate); if (!isNaN(r) && r >= 0) { setTaxRate(r); setIsCustomTaxModalOpen(false); }}} className={`w-full p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${activeThemeName === 'light' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-700 text-white hover:bg-gray-600'}`}><Edit2 size={18} /> Use Custom Rate</button>
                                <button onClick={() => { triggerHaptic(); const r = parseFloat(tempCustomRate); if (!isNaN(r) && r >= 0) { setAvailableRates(prev => (!prev.includes(r) ? [...prev, r].sort((a,b)=>a-b) : prev)); setTaxRate(r); setIsCustomTaxModalOpen(false); }}} className="w-full p-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-colors"><Plus size={18} /> Add to Quick Rates</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`${themeColors.headerBg} ${themeColors.text} border-b ${themeColors.border} px-3 py-2 flex items-center justify-between z-10 h-14 shadow-sm transition-colors duration-300 relative`}>
                      <div className="flex items-center gap-1">
                            <button 
                                onClick={() => { triggerHaptic(); setIsMenuOpen(true); }} 
                                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95`}
                            >
                                <Settings size={20} strokeWidth={2} className="mb-0.5" />
                                <span className="text-[9px] font-extrabold leading-none tracking-wide opacity-80">MENU</span>
                            </button>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                          <h1 className="font-bold text-xl tracking-tight">GANAKA</h1>
                      </div>
                      <div className="flex items-center">
                          <ModeToggle isGstMode={isGstMode} setMode={setIsGstMode} themeColors={themeColors} />
                      </div>
                </div>

                <div className={`${themeColors.tabBg} flex border-b ${themeColors.border}`}>
                    {[0, 1, 2, 3].map((pageIndex) => (
                        <button 
                            key={pageIndex} 
                            onClick={() => { triggerHaptic(); setActiveItemId(null); setCurrentInput(''); setCurrentPage(pageIndex); }} 
                            className={`flex-1 py-3 text-sm font-bold transition-colors relative ${currentPage === pageIndex ? themeColors.tabActive : themeColors.tabInactive}`}
                        >
                            Page {pageIndex + 1}
                            {currentPage === pageIndex && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                        </button>
                    ))}
                </div>

                <div ref={screenshotRef} className={`flex-1 flex flex-col ${getPageBackground()} overflow-hidden relative transition-colors duration-300`}>
                    <div className={`flex-1 ${getPageBackground()} overflow-y-auto px-4 pb-4 pt-0 space-y-0 border-b ${themeColors.border} flex flex-col no-scrollbar`} 
                         onTouchStart={(e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); }} 
                         onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)} 
                         onTouchEnd={onTouchEnd}>
                        {billItems.map((item) => (
                            item.id === activeItemId ? 
                            <ActiveLine key={item.id} currentInput={currentInput} livePreview={livePreview} themeColors={themeColors} inputRef={inputRef} /> : 
                            <CommittedLine key={item.id} item={item} onClick={handleLineClick} themeColors={themeColors} mode={item.mode} />
                        ))}
                        {activeItemId === null && <ActiveLine currentInput={currentInput} livePreview={livePreview} themeColors={themeColors} inputRef={inputRef} />}
                        {[...Array(emptyLines)].map((_, i) => (
                            <div key={`empty-${i}`} className={`flex justify-between items-baseline border-b ${themeColors.itemBorder} py-3 px-2 opacity-10`}>
                                <span className="h-6 w-1/2 bg-current rounded animate-pulse"></span>
                                <span className="h-6 w-12 bg-current rounded animate-pulse"></span>
                            </div>
                        ))}
                        <div ref={listEndRef} />
                    </div>
                    
                    <div className={`${themeColors.totalBarBg} ${themeColors.text} border-t ${themeColors.border} py-3 px-6 z-10 shadow-md transition-colors duration-300`}>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg uppercase tracking-wider opacity-70">Total</span>
                            <span className="text-3xl font-extrabold">{formatNumber(grandTotal)}</span>
                        </div>
                    </div>
                </div>

                <div className={`${themeColors.keypadBg} p-3 grid grid-cols-4 gap-2 border-t ${themeColors.border} pb-6 transition-colors duration-300`}>
                    <Button icon={RotateCcw} label={<span className="text-xs font-bold mt-0.5">PAGE</span>} onClick={() => handleInput('CLEAR_ALL')} className="bg-purple-100 text-purple-700 hover:bg-purple-200" />
                    <Button icon={ChevronsLeft} label={<span className="text-xs font-bold mt-0.5">LINE</span>} onClick={() => handleInput('CLEAR_LINE')} className="bg-blue-100 text-blue-700 hover:bg-blue-200" />
                    <Button icon={ChevronLeft} label={<span className="text-xs font-bold mt-0.5">DIGIT</span>} onClick={() => handleInput('DELETE')} className="bg-rose-100 text-rose-700 hover:bg-rose-200" />
                    <Button icon={CornerDownLeft} label={<span className="text-xs font-bold mt-0.5">ENTER</span>} onClick={() => handleInput('NEXT_LINE')} className="bg-indigo-200 text-indigo-700 hover:bg-indigo-300" />

                    {isGstMode ? (
                        <>
                            <Button 
                                label={
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <div className="flex items-center justify-center h-6 gap-1">
                                            <ChevronLeft size={16} strokeWidth={3} className="opacity-40" />
                                            <span className="text-lg font-bold leading-none pt-0.5">{taxRate}%</span>
                                            <ChevronRight size={16} strokeWidth={3} className="opacity-40" />
                                        </div>
                                        <span className="text-xs font-bold mt-0.5">RATE</span>
                                    </div>
                                } 
                                onPointerDown={handleTaxButtonDown} onPointerUp={handleTaxButtonUp} onClick={handleTaxButtonClick} 
                                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold border-2 border-indigo-200 shadow-sm" 
                            />
                            <Button label={'GST+'} onClick={() => handleInput('TAX+')} className="bg-green-100 text-green-700 hover:bg-green-200 text-sm font-bold" />
                            <Button label={'GST-'} onClick={() => handleInput('TAX-')} className="bg-red-50 text-red-700 hover:bg-red-100 text-sm font-bold" />
                        </>
                    ) : (
                        <>
                            <Button icon={Scissors} onClick={handleCut} className="bg-orange-100 text-orange-700 hover:bg-orange-200" />
                            <Button icon={Copy} onClick={handleCopy} className="bg-blue-100 text-blue-700 hover:bg-blue-200" />
                            <Button icon={Clipboard} onClick={handlePaste} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200" />
                        </>
                    )}

                    <Button label="%" onClick={() => handleInput('%')} className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 font-bold" />
                    <Button label="7" onClick={() => handleInput('7')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="8" onClick={() => handleInput('8')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="9" onClick={() => handleInput('9')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="÷" onClick={() => handleInput('÷')} className="bg-orange-100 text-orange-700 text-2xl" />
                    <Button label="4" onClick={() => handleInput('4')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="5" onClick={() => handleInput('5')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="6" onClick={() => handleInput('6')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="x" onClick={() => handleInput('x')} className="bg-yellow-100 text-yellow-700 text-xl" />
                    <Button label="1" onClick={() => handleInput('1')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="2" onClick={() => handleInput('2')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="3" onClick={() => handleInput('3')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="-" onClick={() => handleInput('-')} className="bg-sky-100 text-sky-700 text-2xl" />
                    <Button label="( )" onClick={() => handleInput('()')} className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 font-bold" />
                    <Button label="0" onClick={() => handleInput('0')} className="bg-white shadow-sm hover:bg-gray-50 text-gray-800" />
                    <Button label="." onClick={() => handleInput('.')} className="bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold text-xl" />
                    <Button label="+" onClick={() => handleInput('+')} className="bg-teal-100 text-teal-700 text-2xl" />
                </div>
            </div>
        </div>
    );
};

export default App;