import { useMemo, useState } from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
    seed: string;
    name: string;
    imageUrl?: string;
    size?: number;
}

const initialsFromName = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    if (parts.length === 1) {
        return parts[0].slice(0, 1).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const Avatar = ({ seed, name, imageUrl, size = 36 }: AvatarProps) => {
    const [useFallback, setUseFallback] = useState(false);
    const initials = useMemo(() => initialsFromName(name), [name]);
    const generatedAvatarUrl = useMemo(
        () => `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(seed || name)}&backgroundType=gradientLinear`,
        [seed, name],
    );
    const avatarUrl = imageUrl || generatedAvatarUrl;

    return (
        <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">
            {!useFallback ? (
                <img
                    src={avatarUrl}
                    alt=""
                    width={size}
                    height={size}
                    onError={() => setUseFallback(true)}
                />
            ) : (
                <span className={styles.initials}>{initials}</span>
            )}
        </span>
    );
};
