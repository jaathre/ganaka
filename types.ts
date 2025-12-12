
// Global variable declarations for the specific environment
declare global {
    interface Window {
        __app_id?: string;
        __firebase_config?: string;
        __initial_auth_token?: string;
    }
    var __app_id: string | undefined;
    var __firebase_config: string | undefined;
    var __initial_auth_token: string | undefined;
}

export interface BillItem {
    id: number;
    expression: string;
    result: number;
    mode?: 'GST' | 'TAX';
    type?: 'add' | 'remove';
    rate?: number;
    details?: {
        base: number;
        rate: number;
        taxAmt: number;
    } | null;
    timestamp?: number;
}

export interface ThemeColors {
    bg: string;
    appBg: string;
    text: string;
    subText: string;
    border: string;
    headerBg: string;
    tabBg: string;
    tabActive: string;
    tabInactive: string;
    keypadBg: string;
    totalBarBg: string;
    menuBg: string;
    itemBorder: string;
    menuItemHover: string;
    menuItemActive: string;
    activeLineBg: string;
    displayBorder: string;
}

export type ThemeName = 'light' | 'dark';

export type DecimalConfig = 'auto' | number;

export type NumberFormat = 'IN' | 'INTL' | 'NONE';