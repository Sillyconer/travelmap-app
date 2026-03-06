import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { showSnackbar } from '../components/ui/Snackbar';
import styles from './SettingsPage.module.css';
import { MdMap, MdAttachMoney } from 'react-icons/md';
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import type { CurrencyOption } from '../types/models';
import { useNavigate } from 'react-router-dom';
import type { MapStyle } from '../store/useSettingsStore';

const UI_THEMES = [
    {
        id: 'dark-matter',
        label: 'Dark Matter',
        vibe: 'Warm journal',
        colors: ['#121110', '#F0C75E', '#A8CEA8'],
    },
    {
        id: 'positron',
        label: 'Positron',
        vibe: 'Clean cartography',
        colors: ['#FAFAF8', '#2C3E6D', '#266D78'],
    },
    {
        id: 'voyager',
        label: 'Voyager',
        vibe: 'Vibrant explorer',
        colors: ['#1A1820', '#FF7F6E', '#75D8C6'],
    },
    {
        id: 'oceanic',
        label: 'Oceanic',
        vibe: 'Deep maritime',
        colors: ['#0F1722', '#5DB7FF', '#6EE7D8'],
    },
    {
        id: 'atlas-sand',
        label: 'Atlas Sand',
        vibe: 'Sunlit atlas',
        colors: ['#F6F2EA', '#8A5A3B', '#3F6C5B'],
    },
    {
        id: 'pine-trail',
        label: 'Pine Trail',
        vibe: 'Forest expedition',
        colors: ['#121A15', '#86C06C', '#D2B979'],
    },
] as const;

const MAP_STYLE_OPTIONS: Array<{ id: MapStyle; label: string }> = [
    { id: 'dark-matter', label: 'Dark Matter' },
    { id: 'positron', label: 'Positron (Light)' },
    { id: 'voyager', label: 'Voyager (Colorful)' },
    { id: 'voyager-neo', label: 'Voyager Neo (Theme-Matched)' },
    { id: 'oceanic-deep', label: 'Oceanic Deep (Theme-Matched)' },
    { id: 'pine-earth', label: 'Pine Earth (Theme-Matched)' },
    { id: 'voyager-nolabels', label: 'Voyager No Labels' },
    { id: 'osm-standard', label: 'OSM Standard' },
    { id: 'terrain', label: 'Terrain (Topo)' },
];

const COUNTRY_TO_CURRENCY: Record<string, string> = {
    US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS',
    GB: 'GBP', IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
    CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
    JP: 'JPY', CN: 'CNY', IN: 'INR', KR: 'KRW', SG: 'SGD', HK: 'HKD', TH: 'THB', ID: 'IDR', MY: 'MYR', PH: 'PHP', VN: 'VND',
    AU: 'AUD', NZ: 'NZD', ZA: 'ZAR', AE: 'AED', SA: 'SAR', TR: 'TRY',
};

type UiThemeId = (typeof UI_THEMES)[number]['id'];

export const SettingsPage = () => {
    const { currency, mapStyle, uiTheme, setCurrency, setMapStyle, setUiTheme } = useSettingsStore();
    const logout = useAuthStore(s => s.logout);
    const user = useAuthStore(s => s.user);
    const updateProfile = useAuthStore(s => s.updateProfile);
    const navigate = useNavigate();
    const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
    const [homeCountry, setHomeCountry] = useState(user?.homeCountry ?? '');

    const flag = useMemo(() => {
        const code = (homeCountry || '').trim().toUpperCase();
        if (code.length !== 2) return '';
        return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
    }, [homeCountry]);

    useEffect(() => {
        const loadCurrencies = async () => {
            try {
                const data = await api.getCurrencies();
                setCurrencies(data);
            } catch {
                setCurrencies([]);
            }
        };
        loadCurrencies();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const handleHomeCurrency = async (value: string) => {
        setCurrency(value);
        await updateProfile({ homeCurrency: value });
    };

    const handleHomeCountryBlur = async () => {
        const code = homeCountry.trim().toUpperCase();
        const mappedCurrency = COUNTRY_TO_CURRENCY[code];
        const supported = new Set((currencies.length > 0 ? currencies : [{ code: 'USD', name: 'US Dollar' }]).map(c => c.code));

        if (mappedCurrency && supported.has(mappedCurrency)) {
            setCurrency(mappedCurrency);
            await updateProfile({ homeCountry: code, homeCurrency: mappedCurrency });
            showSnackbar(`Home currency set to ${mappedCurrency} based on country ${code}`);
        } else {
            await updateProfile({ homeCountry: code });
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Settings</h1>
                <p>Customize your TravelMap experience.</p>
            </header>

            <main className={styles.content}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}><MdMap className={styles.icon} /> Map Appearance</h2>
                    <Card className={styles.settingsCard}>
                        <div className={styles.settingRow}>
                            <div className={styles.settingInfo}>
                                <h3>Map Style</h3>
                                <p>Choose the visual style for the main world map.</p>
                            </div>
                            <select
                                value={mapStyle}
                                onChange={(e) => setMapStyle(e.target.value as MapStyle)}
                                className={styles.select}
                            >
                                {MAP_STYLE_OPTIONS.map(option => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </Card>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}><MdAttachMoney className={styles.icon} /> Currency & Formatting</h2>
                    <Card className={styles.settingsCard}>
                        <div className={styles.settingRow}>
                            <div className={styles.settingInfo}>
                                <h3>Global Currency</h3>
                                <p>Set the primary currency used for displaying trip budgets and expenses.</p>
                            </div>
                            <select value={currency} onChange={(e) => handleHomeCurrency(e.target.value)} className={styles.select}>
                                {(currencies.length > 0 ? currencies : [{ code: 'USD', name: 'US Dollar' }]).map((c) => (
                                    <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.settingRow}>
                            <div className={styles.settingInfo}>
                                <h3>UI Color Style</h3>
                                <p>Pick a full-app color palette independent from map tiles.</p>
                            </div>
                            <select
                                value={uiTheme}
                                onChange={(e) => setUiTheme(e.target.value as UiThemeId)}
                                className={styles.select}
                            >
                                {UI_THEMES.map(theme => (
                                    <option key={theme.id} value={theme.id}>{theme.label}</option>
                                ))}
                            </select>
                        </div>
                    </Card>

                    <div className={styles.paletteGrid}>
                        {UI_THEMES.map(theme => (
                            <button
                                key={theme.id}
                                className={`${styles.paletteCard} ${uiTheme === theme.id ? styles.paletteCardActive : ''}`}
                                onClick={() => setUiTheme(theme.id)}
                                type="button"
                            >
                                <div className={styles.paletteTop}>
                                    <strong>{theme.label}</strong>
                                    <span>{theme.vibe}</span>
                                </div>
                                <div className={styles.swatches}>
                                    {theme.colors.map((color) => (
                                        <span key={color} className={styles.swatch} style={{ backgroundColor: color }} title={color} />
                                    ))}
                                </div>
                                <p className={styles.hexRow}>{theme.colors.join(' · ')}</p>
                            </button>
                        ))}
                    </div>
                </section>

                <section className={styles.section}>
                    <Card className={styles.settingsCard}>
                        <div className={styles.settingRow}>
                            <div className={styles.settingInfo}>
                                <h3>Home Country</h3>
                                <p>Used for profile and travel context (2-letter code).</p>
                            </div>
                            <div className={styles.countryRow}>
                                <input
                                    className={styles.countryInput}
                                    value={homeCountry}
                                    maxLength={2}
                                    onChange={(e) => setHomeCountry(e.target.value.toUpperCase())}
                                    onBlur={handleHomeCountryBlur}
                                    placeholder="US"
                                />
                                <span className={styles.flag}>{flag}</span>
                            </div>
                        </div>
                    </Card>
                </section>

                <section className={styles.section}>
                    <Card className={styles.settingsCard}>
                        <div className={styles.settingRow}>
                            <div className={styles.settingInfo}>
                                <h3>Account</h3>
                                <p>Sign out of this device.</p>
                            </div>
                            <Button variant="outlined" onClick={handleLogout}>Logout</Button>
                        </div>
                    </Card>
                </section>
            </main>
        </div>
    );
};
