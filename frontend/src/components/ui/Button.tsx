import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'filled' | 'outlined' | 'text' | 'tonal';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'filled', size = 'md', fullWidth = false, children, ...props }, ref) => {

        // Combine base class + variant + size + layout
        const btnClasses = [
            styles.base,
            styles[variant],
            styles[size],
            fullWidth ? styles.fullWidth : '',
            className
        ].filter(Boolean).join(' ');

        return (
            <button ref={ref} className={btnClasses} {...props}>
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
