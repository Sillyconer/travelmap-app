import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    currency: string;
    mapStyle: 'voyager' | 'positron' | 'dark-matter';
    uiTheme: 'dark-matter' | 'positron' | 'voyager' | 'oceanic' | 'atlas-sand' | 'pine-trail';
    setCurrency: (currency: string) => void;
    setMapStyle: (style: 'voyager' | 'positron' | 'dark-matter') => void;
    setUiTheme: (theme: 'dark-matter' | 'positron' | 'voyager' | 'oceanic' | 'atlas-sand' | 'pine-trail') => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            currency: 'USD',
            mapStyle: 'dark-matter', // default to match M3 dark theme
            uiTheme: 'dark-matter',
            setCurrency: (currency) => set({ currency }),
            setMapStyle: (mapStyle) => set({ mapStyle }),
            setUiTheme: (uiTheme) => {
                document.documentElement.dataset.theme = uiTheme;
                set({ uiTheme });
            },
        }),
        {
            name: 'travelmap-settings',
        }
    )
);
