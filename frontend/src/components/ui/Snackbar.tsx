import { Toaster, toast } from 'sonner';

/**
 * TravelMap — Snackbar Configuration
 * 
 * We use `sonner` for our toast notifications, but wrap it to automatically
 * apply our M3 design tokens.
 */

export const SnackbarProvider = () => {
    return (
        <Toaster
            position="bottom-center"
            toastOptions={{
                style: {
                    background: 'var(--md-sys-color-inverse-surface)',
                    color: 'var(--md-sys-color-inverse-on-surface)',
                    border: 'none',
                    borderRadius: 'var(--md-sys-shape-corner-extra-small)',
                    fontFamily: 'var(--md-sys-typescale-body-medium-font)',
                    fontSize: 'var(--md-sys-typescale-body-medium-size)',
                    boxShadow: 'var(--md-sys-elevation-3)',
                    padding: '14px 16px',
                },
                className: 'm3-snackbar',
            }}
        />
    );
};

// Export the underlying toast function for use in components
export { toast as showSnackbar };
