import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import styles from './SettingsPage.module.css';
import { MdMap, MdAttachMoney } from 'react-icons/md';
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import type { CurrencyOption } from '../types/models';
import { useNavigate } from 'react-router-dom';

export const SettingsPage = () => {
    const { currency, mapStyle, setCurrency, setMapStyle } = useSettingsStore();
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
        await updateProfile({ homeCountry });
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
                                onChange={(e) => setMapStyle(e.target.value as any)}
                                className={styles.select}
                            >
                                <option value="dark-matter">Dark Matter (Default)</option>
                                <option value="positron">Positron (Light)</option>
                                <option value="voyager">Voyager (Colorful)</option>
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
                    </Card>
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
