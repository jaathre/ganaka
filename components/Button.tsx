import React from 'react';
import { LucideIcon } from 'lucide-react';
import { triggerHaptic } from '../utils';

interface ButtonProps {
    label?: React.ReactNode;
    onClick: () => void;
    className?: string;
    icon?: LucideIcon;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, className = '', icon: Icon, onPointerDown, onPointerUp }) => (
    <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
            triggerHaptic();
            onClick();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onMouseLeave={onPointerUp}
        className={`relative flex flex-col items-center justify-center h-16 rounded-lg text-xl font-medium transition-all active:scale-95 shadow-sm select-none ${label ? 'gap-0.5' : ''} ${className}`}
    >
        {Icon && <Icon size={label ? 20 : 24} strokeWidth={2.5} />}
        {label && <div className="flex items-center justify-center w-full leading-none">{label}</div>}
    </button>
);