import { InputHTMLAttributes, forwardRef, useId } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, helperText, fullWidth = false, required, ...props }, ref) => {

        const id = useId();
        const inputId = props.id || id;
        const isError = Boolean(error);

        const containerClasses = [
            styles.container,
            isError ? styles.errorState : '',
            fullWidth ? styles.fullWidth : '',
            className
        ].filter(Boolean).join(' ');

        return (
            <div className={containerClasses}>
                <div className={styles.inputWrapper}>
                    <input
                        ref={ref}
                        id={inputId}
                        className={styles.input}
                        placeholder=" " /* Required for floating label CSS hack */
                        required={required}
                        aria-invalid={isError}
                        {...props}
                    />
                    <label htmlFor={inputId} className={styles.label}>
                        {label}{required && ' *'}
                    </label>
                </div>

                {(helperText || error) && (
                    <div className={styles.supportText}>
                        {error || helperText}
                    </div>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
