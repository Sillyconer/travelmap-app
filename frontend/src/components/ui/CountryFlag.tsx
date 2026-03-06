import { useEffect, useState } from 'react';

const FLAG_CACHE = new Map<string, string>();

const toFlagFromCode = (code: string): string => {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) {
        return '';
    }
    return String.fromCodePoint(...normalized.split('').map(char => 127397 + char.charCodeAt(0)));
};

const resolveCountryFlag = async (country: string): Promise<string> => {
    const normalized = country.trim();
    if (!normalized) {
        return '';
    }
    const cached = FLAG_CACHE.get(normalized.toLowerCase());
    if (cached !== undefined) {
        return cached;
    }

    const codeFlag = toFlagFromCode(normalized);
    if (codeFlag) {
        FLAG_CACHE.set(normalized.toLowerCase(), codeFlag);
        return codeFlag;
    }

    try {
        const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(normalized)}?fields=flag,cca2`);
        if (!response.ok) {
            FLAG_CACHE.set(normalized.toLowerCase(), '');
            return '';
        }
        const payload = await response.json();
        const first = Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
        const fromApi = typeof first?.flag === 'string' ? first.flag : toFlagFromCode(String(first?.cca2 || ''));
        const resolved = fromApi || '';
        FLAG_CACHE.set(normalized.toLowerCase(), resolved);
        return resolved;
    } catch {
        FLAG_CACHE.set(normalized.toLowerCase(), '');
        return '';
    }
};

interface CountryFlagProps {
    country: string;
}

export const CountryFlag = ({ country }: CountryFlagProps) => {
    const [flag, setFlag] = useState('');

    useEffect(() => {
        let active = true;
        resolveCountryFlag(country).then(value => {
            if (active) {
                setFlag(value);
            }
        });
        return () => {
            active = false;
        };
    }, [country]);

    if (!flag) {
        return null;
    }
    return <span title={country}>{flag}</span>;
};
