import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// Placeholder Pages
const MapPage = () => <div style={{ padding: 24 }}><h2>Map View</h2><p>Coming in Phase 3.</p></div>;
const AlbumsPage = () => <div style={{ padding: 24 }}><h2>Albums</h2><p>Coming in Phase 5.</p></div>;
const PhotosPage = () => <div style={{ padding: 24 }}><h2>Photos</h2><p>Coming in Phase 5.</p></div>;
const TripsPage = () => <div style={{ padding: 24 }}><h2>Manage Trips</h2><p>Coming in Phase 2.</p></div>;
const PeoplePage = () => <div style={{ padding: 24 }}><h2>People</h2><p>Coming in Phase 2.</p></div>;
const SettingsPage = () => <div style={{ padding: 24 }}><h2>Settings</h2><p>Coming in Phase 6.</p></div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MapPage />} />
          <Route path="albums" element={<AlbumsPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
