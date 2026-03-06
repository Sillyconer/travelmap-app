import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ManageTripsPage } from './pages/ManageTripsPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { ManagePersonsPage } from './pages/ManagePersonsPage';
import { HomePage } from './pages/HomePage';
import { PhotosPage } from './pages/PhotosPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharePage } from './pages/SharePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProfilesPage } from './pages/ProfilesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { useAuthStore } from './store/useAuthStore';

const ProtectedLayout = () => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
};

function App() {
  const loadMe = useAuthStore(s => s.loadMe);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="albums" element={<AlbumsPage />} />
          <Route path="albums/:id" element={<AlbumDetailPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="trips" element={<ManageTripsPage />} />
          <Route path="trips/:id" element={<TripDetailPage />} />
          <Route path="people" element={<ManagePersonsPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="profiles/:username" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* Share page — standalone, outside Layout (no sidebar) */}
        <Route path="/s/:token" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
