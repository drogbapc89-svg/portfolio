import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CulturalTopic,
  Destination,
  EconomyMetric,
  FavoriteItem,
  HistoryEvent,
  NationalProject,
  NewsArticle,
  PageSection,
  PoliticalInstitution,
  SportsRecord,
  TripPlan,
  UserProfile,
} from './types/morocco';
import {
  SEED_CULTURE,
  SEED_DESTINATIONS,
  SEED_ECONOMY,
  SEED_HISTORY,
  SEED_NEWS,
  SEED_POLITICS,
  SEED_PROJECTS,
  SEED_SPORTS,
} from './data/seedEncyclopedia';
import { useThemeAndLocale } from './hooks/useThemeAndLocale';
import {
  fetchEncyclopediaSnapshot,
  fetchUserFavorites,
  fetchUserTrips,
} from './services/api';
import { Navbar } from './components/Navbar';
import { SectionRouter } from './pages/SectionRouter';
import { Footer } from './components/Footer';
import { SearchModal } from './components/SearchModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const { language, setLanguage, darkMode, toggleDarkMode } = useThemeAndLocale();
  const [activeSection, setActiveSection] = useState<PageSection>('home');

  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>(SEED_HISTORY);
  const [projects, setProjects] = useState<NationalProject[]>(SEED_PROJECTS);
  const [news, setNews] = useState<NewsArticle[]>(SEED_NEWS);
  const [destinations, setDestinations] = useState<Destination[]>(SEED_DESTINATIONS);
  const [sportsRecords, setSportsRecords] = useState<SportsRecord[]>(SEED_SPORTS);
  const [politics, setPolitics] = useState<PoliticalInstitution[]>(SEED_POLITICS);
  const [culture, setCulture] = useState<CulturalTopic[]>(SEED_CULTURE);
  const [economy, setEconomy] = useState<EconomyMetric[]>(SEED_ECONOMY);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [toast, setToast] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fetchEncyclopedia = useCallback(async () => {
    try {
      const data = await fetchEncyclopediaSnapshot();
      if (!data) return;
      if (Array.isArray(data.historyEvents)) setHistoryEvents(data.historyEvents);
      if (Array.isArray(data.projects)) setProjects(data.projects);
      if (Array.isArray(data.news)) setNews(data.news);
      if (Array.isArray(data.destinations)) setDestinations(data.destinations);
      if (Array.isArray(data.sportsRecords)) setSportsRecords(data.sportsRecords);
      if (Array.isArray(data.politics)) setPolitics(data.politics);
      if (Array.isArray(data.culture)) setCulture(data.culture);
      if (Array.isArray(data.economy)) setEconomy(data.economy);
    } catch {
      // Seed snapshot remains active
    }
  }, []);

  useEffect(() => {
    fetchEncyclopedia();
  }, [fetchEncyclopedia]);

  const fetchUserCollections = useCallback(async (authToken: string) => {
    try {
      const [favs, userTrips] = await Promise.all([
        fetchUserFavorites(authToken),
        fetchUserTrips(authToken),
      ]);
      setFavorites(favs);
      setTrips(userTrips);
    } catch {
      // ignore transient errors
    }
  }, []);

  const handleAuthSuccess = (newToken: string, profile: UserProfile) => {
    setToken(newToken);
    setUser(profile);
    fetchUserCollections(newToken);
    showToast(`Signed in as ${profile.name}`);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setFavorites([]);
    setTrips([]);
    if (activeSection === 'admin') {
      setActiveSection('home');
    }
    showToast('Signed out');
  };

  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.itemId)),
    [favorites]
  );

  const handleToggleFavorite = async (
    itemType: 'project' | 'news' | 'destination' | 'history',
    itemId: string,
    title: string
  ) => {
    if (!token || !user) {
      setAuthOpen(true);
      showToast('Sign in to save favorites to your account.');
      return;
    }

    if (favoriteIds.has(itemId)) {
      const res = await fetch(`/api/favorites/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.itemId !== itemId));
        showToast('Removed from saved favorites.');
      }
    } else {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemType, itemId, title }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.favorite) {
          setFavorites((prev) => [...prev, data.favorite]);
          showToast('Saved to your account.');
        }
      }
    }
  };

  const handleRemoveFavorite = async (itemId: string) => {
    if (!token) return;
    const res = await fetch(`/api/favorites/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setFavorites((prev) => prev.filter((f) => f.itemId !== itemId));
    }
  };

  const handleSaveTrip = async (trip: {
    title: string;
    destinationIds: string[];
    days: number;
    notes: string;
  }) => {
    if (!token) return;
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(trip),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.trip) {
        setTrips((prev) => [...prev, data.trip]);
        showToast('Itinerary saved to your account.');
      }
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setTrips((prev) => prev.filter((t) => t.id !== id));
      showToast('Itinerary removed.');
    }
  };

  const navigateTo = (section: PageSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#0E1513] text-[#161A18] dark:text-[#F5F2EB]">
      <Navbar
        language={language}
        setLanguage={setLanguage}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        activeSection={activeSection}
        onNavigate={navigateTo}
        onOpenSearch={() => {
          setSearchInitialQuery('');
          setSearchOpen(true);
        }}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenAi={() => setAiOpen(true)}
        user={user}
      />

      <main className={`flex-1 ${activeSection !== 'home' ? 'pt-16' : ''}`}>
        <SectionRouter
          activeSection={activeSection}
          language={language}
          token={token}
          user={user}
          historyEvents={historyEvents}
          politics={politics}
          projects={projects}
          economy={economy}
          sportsRecords={sportsRecords}
          destinations={destinations}
          culture={culture}
          news={news}
          favoriteIds={favoriteIds}
          trips={trips}
          onNavigate={navigateTo}
          onSearchSubmit={(q) => {
            setSearchInitialQuery(q);
            setSearchOpen(true);
          }}
          onOpenAi={() => setAiOpen(true)}
          onOpenAuth={() => setAuthOpen(true)}
          onToggleFavorite={handleToggleFavorite}
          onSaveTrip={handleSaveTrip}
          onDeleteTrip={handleDeleteTrip}
          onRefreshData={fetchEncyclopedia}
        />
      </main>

      <Footer language={language} onNavigate={navigateTo} />

      <SearchModal
        open={searchOpen}
        initialQuery={searchInitialQuery}
        language={language}
        onClose={() => setSearchOpen(false)}
        onSelectSection={navigateTo}
      />

      <AiAssistantModal
        open={aiOpen}
        language={language}
        onClose={() => setAiOpen(false)}
      />

      <AuthModal
        open={authOpen}
        language={language}
        user={user}
        favorites={favorites}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onRemoveFavorite={handleRemoveFavorite}
        onNavigateAdmin={navigateTo}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 end-5 z-50 px-4 py-2.5 rounded-xl bg-[#064E3B] text-white dark:bg-[#C5A46D] dark:text-[#101A19] text-xs font-semibold shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
