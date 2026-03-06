import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    currency: string;
    mapStyle: 'voyager' | 'positron' | 'dark-matter';
    setCurrency: (currency: string) => void;
    setMapStyle: (style: 'voyager' | 'positron' | 'dark-matter') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            currency: 'USD',
            mapStyle: 'dark-matter', // default to match M3 dark theme
            setCurrency: (currency) => set({ currency }),
            setMapStyle: (mapStyle) => {
                document.documentElement.dataset.theme = mapStyle;
                set({ mapStyle });
            },
        }),
        {
            name: 'travelmap-settings',
        }
    )
);
