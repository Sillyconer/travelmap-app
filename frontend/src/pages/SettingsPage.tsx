import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import styles from './SettingsPage.module.css';
import { MdMap, MdAttachMoney } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';

export const SettingsPage = () => {
    const { currency, mapStyle, setCurrency, setMapStyle } = useSettingsStore();
    const logout = useAuthStore(s => s.logout);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
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
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className={styles.select}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="AUD">AUD ($)</option>
                                <option value="CAD">CAD ($)</option>
                                <option value="CHF">CHF (Fr)</option>
                                <option value="CNY">CNY (¥)</option>
                                <option value="INR">INR (₹)</option>
                            </select>
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
