import PortkeyCheck from '@/components/home/PortkeyCheck';

// Scaffold page: proves brand theming + Portkey wiring. Becomes the /login | /subjects redirect later.
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-lg px-lg py-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-heading text-2xl font-bold">Perspectives</h1>
        <p className="text-muted">Scaffold page. Nothing to see yet.</p>
      </header>
      <PortkeyCheck />
    </main>
  );
}
