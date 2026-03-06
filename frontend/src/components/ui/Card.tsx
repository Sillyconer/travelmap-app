import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'elevated' | 'filled' | 'outlined';
    interactive?: boolean;
}

export const Card = ({
    className = '',
    variant = 'elevated',
    interactive = false,
    children,
    ...props
}: CardProps) => {
    const cn = [
        styles.card,
        styles[variant],
        interactive && styles.interactive,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={cn} {...props}>
            {children}
        </div>
    );
};
