import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MapStyle =
    | 'dark-matter'
    | 'positron'
    | 'voyager'
    | 'voyager-nolabels'
    | 'osm-standard'
    | 'terrain'
    | 'oceanic-deep'
    | 'voyager-neo'
    | 'pine-earth';

export type UiTheme =
    | 'dark-matter'
    | 'positron'
    | 'voyager'
    | 'oceanic'
    | 'atlas-sand'
    | 'pine-trail';

const THEME_TO_MAP_STYLE: Record<UiTheme, MapStyle> = {
    'dark-matter': 'dark-matter',
    positron: 'positron',
    voyager: 'voyager-neo',
    oceanic: 'oceanic-deep',
    'atlas-sand': 'terrain',
    'pine-trail': 'pine-earth',
};

interface SettingsState {
    currency: string;
    mapStyle: MapStyle;
    uiTheme: UiTheme;
    setCurrency: (currency: string) => void;
    setMapStyle: (style: MapStyle) => void;
    setUiTheme: (theme: UiTheme) => void;
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
                set({ uiTheme, mapStyle: THEME_TO_MAP_STYLE[uiTheme] });
            },
        }),
        {
            name: 'travelmap-settings',
        }
    )
);
