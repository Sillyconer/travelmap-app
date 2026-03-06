import { useState } from 'react';
import { MapLayer } from '../components/map/MapLayer';
import { MapSidebar } from '../components/map/MapSidebar';
import { Button } from '../components/ui/Button';
import { ListFilter } from 'lucide-react';
import styles from './HomePage.module.css';

export const HomePage = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className={styles.layout}>
            <MapLayer />

            <Button
                variant="filled"
                className={styles.toggleBtn}
                onClick={() => setIsSidebarOpen(true)}
                style={{
                    display: isSidebarOpen ? 'none' : 'flex',
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    zIndex: 10
                }}
            >
                <ListFilter size={20} />
                Filters
            </Button>

            <MapSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>
    );
};
