import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
    RefreshCw, ChevronsLeft, ChevronLeft, CornerDownLeft, X, Percent, 
    Check, Edit2, Trash2, Plus, Settings, ArrowLeft, 
    ChevronRight, Info, Github, Globe, ChevronDown, ChevronUp
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

import { Button } from './components/Button';
import { ActiveLine } from './components/ActiveLine';
import { CommittedLine } from './components/CommittedLine';
import { formatNumber, evaluateExpression, triggerHaptic } from './utils';
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

const LabelText: React.FC<{ text: string }> = ({ text }) => 
    <span className="text-[9px] font-bold mt-1.5 leading-none opacity-60">{text}</span>;

const App = () => {
    // --- State ---
    const [pages, setPages] = useState<BillItem[][]>(Array.from({ length: 4 }, () => [])); 
    const [currentPage, setCurrentPage] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null); 
    const [, setUserId] = useState<string | null>(null);

    // Settings State
    const [taxRate, setTaxRate] = useState(18); 
    const [availableRates, setAvailableRates] = useState([5, 18, 40]); 
    const [decimalConfig, setDecimalConfig] = useState<DecimalConfig>(2);
    const [numberFormat, setNumberFormat] = useState<NumberFormat>('IN');

    // UI State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState('main'); 
    const [editingRateIndex, setEditingRateIndex] = useState<number | null>(null);
    const [newRateInput, setNewRateInput] = useState('');
    const [isKeypadExpanded, setIsKeypadExpanded] = useState(true);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number | null>(null);
    const editRateInputRef = useRef<HTMLInputElement>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    
    // Long Press Refs
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressRef = useRef(false);
    
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

    useEffect(() => {
        if (!isMenuOpen) {
            const timer = setTimeout(() => {
                setMenuView('main');
                setEditingRateIndex(null);
                setNewRateInput('');
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isMenuOpen]);

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

    const handleTaxCalculation = (isAdd: boolean) => {
        const baseVal = evaluateExpression(currentInput);
        if (baseVal === 0 && currentInput === '') return;
        
        const rateDecimal = taxRate / 100;
        const finalVal = isAdd ? baseVal * (1 + rateDecimal) : baseVal / (1 + rateDecimal);
        const taxAmount = isAdd ? finalVal - baseVal : baseVal - finalVal;

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
        } else if (distance < -50 && currentPage > 0) { 
            triggerHaptic();
            setActiveItemId(null); setCurrentInput(''); setCurrentPage(c => c - 1); 
        }
        setTouchStart(null);
        setTouchEnd(null);
    };

    // --- Tax Rate Cycling Logic ---
    const cycleTaxRate = () => {
        if (availableRates.length === 0) return;
        setTaxRate(prev => {
            const currentIndex = availableRates.indexOf(prev);
            const nextIndex = (currentIndex + 1) % availableRates.length;
            return availableRates[nextIndex];
        });
    };

    const handleTaxButtonDown = () => {
        isLongPressRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            triggerHaptic();
            cycleTaxRate();
        }, 500);
    };

    const handleTaxButtonUp = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleTaxAction = (isAdd: boolean) => {
        if (isLongPressRef.current) {
            isLongPressRef.current = false;
            // Prevent standard calculation if long press occurred
            return;
        }
        handleTaxCalculation(isAdd);
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

    return (
        <div className={`w-full h-[100dvh] ${themeColors.appBg} overflow-hidden flex flex-col relative transition-colors duration-300`}>
            
            {/* --- Menu Overlay --- */}
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
                                    {[
                                        { id: 'taxRates', icon: Percent, label: 'Tax Rates' },
                                        { id: 'formatting', icon: Globe, label: 'Number System' },
                                        { id: 'about', icon: Info, label: 'About' }
                                    ].map(item => (
                                        <button key={item.id} onClick={() => { triggerHaptic(); setMenuView(item.id); }} className={`flex items-center justify-between w-full p-4 rounded-xl text-lg font-medium transition-colors outline-none ${themeColors.text} ${themeColors.menuItemHover}`}>
                                            <div className="flex items-center gap-3"><item.icon size={22} /> {item.label}</div><ChevronRight size={20} className="opacity-50" />
                                        </button>
                                    ))}
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
                                    <div className="space-y-3">
                                        {[
                                            { id: 'IN', label: 'Indian', desc: 'Lakhs & Crores (1,23,456.78)' },
                                            { id: 'INTL', label: 'International', desc: 'Millions (123,456.78)' },
                                            { id: 'NONE', label: 'None', desc: 'Raw number (123456.78)' }
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { triggerHaptic(); setNumberFormat(opt.id as NumberFormat); }} className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all outline-none ${numberFormat === opt.id ? themeColors.menuItemActive + ' border-transparent' : themeColors.itemBorder + ' ' + themeColors.text + ' ' + themeColors.menuItemHover}`}>
                                                <div className="flex flex-col items-start"><span className="font-semibold text-lg">{opt.label}</span><span className="text-xs opacity-60">{opt.desc}</span></div>
                                                {numberFormat === opt.id && <Check size={20} />}
                                            </button>
                                        ))}
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
                                        <p className={`opacity-70 ${themeColors.subText}`}>A powerful, intuitive calculator designed for rapid GST calculations and multi-page management.</p>
                                        <div className="pt-6 w-full">
                                            <a href="https://github.com/jaathre" target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 p-4 rounded-xl w-full font-bold transition-colors border ${themeColors.border} ${themeColors.menuItemHover}`}>
                                                <Github size={20} /> Visit GitHub
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
                        <span className={`text-2xl font-bold ${themeColors.text}`}>{formatNumber(grandTotal, decimalConfig, numberFormat)}</span>
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

                        {/* Row 2 */}
                        <Button 
                            label={<span className="text-xl tracking-widest font-bold">( )</span>} 
                            onClick={() => handleInput('()')} 
                            className="bg-violet-200 text-black active:bg-violet-300 shadow-sm" 
                        />
                        <Button 
                            label={<div className="flex flex-col items-center"><span>GST+</span><LabelText text={`${taxRate}%`} /></div>} 
                            onClick={() => handleTaxAction(true)} 
                            onPointerDown={handleTaxButtonDown}
                            onPointerUp={handleTaxButtonUp}
                            className="bg-teal-200 text-black active:bg-teal-300 text-sm font-bold" 
                        />
                        <Button 
                            label={<div className="flex flex-col items-center"><span>GST-</span><LabelText text={`${taxRate}%`} /></div>} 
                            onClick={() => handleTaxAction(false)} 
                            onPointerDown={handleTaxButtonDown}
                            onPointerUp={handleTaxButtonUp}
                            className="bg-rose-200 text-black active:bg-rose-300 text-sm font-bold" 
                        />
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
                        <Button icon={Settings} label={<LabelText text="GANAKA" />} onClick={() => { triggerHaptic(); setIsMenuOpen(true); }} className="bg-stone-200 text-black active:bg-stone-300 font-bold" />
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