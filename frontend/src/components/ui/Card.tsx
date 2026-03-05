import { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'elevated' | 'filled' | 'outlined';
}

export const Card = ({
    className = '',
    variant = 'elevated',
    children,
    ...props
}: CardProps) => {
    const cn = [
        styles.card,
        styles[variant],
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={cn} {...props}>
            {children}
        </div>
    );
};
