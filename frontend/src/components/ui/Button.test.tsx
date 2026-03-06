import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { vi, describe, it, expect } from 'vitest';

describe('Button Component', () => {
    it('renders correctly with default props', () => {
        render(<Button>Click Me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button.className).toMatch(/filled/); // Default variant
    });

    it('applies the outlined variant correctly', () => {
        render(<Button variant="outlined">Outlined</Button>);
        const button = screen.getByRole('button', { name: /outlined/i });
        expect(button.className).toMatch(/outlined/);
    });

    it('calls onClick handler when clicked', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Clickable</Button>);
        const button = screen.getByRole('button', { name: /clickable/i });

        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when the disabled prop is true', () => {
        const handleClick = vi.fn();
        render(<Button disabled onClick={handleClick}>Disabled</Button>);
        const button = screen.getByRole('button', { name: /disabled/i });

        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });
});
