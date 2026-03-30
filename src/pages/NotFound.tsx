import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="text-center space-y-4">
      <h1 className="text-6xl font-black text-[hsl(var(--accent-primary))]">404</h1>
      <p className="text-xl font-medium">Page not found</p>
      <p className="text-muted-foreground text-sm">The page you're looking for doesn't exist.</p>
      <Link to="/" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[hsl(var(--accent-primary))] text-white font-semibold hover:opacity-90 transition-opacity text-sm">
        Back to home
      </Link>
    </div>
  </div>
);

export default NotFound;
