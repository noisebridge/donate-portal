import paths from "~/paths";

export interface NavbarProps {
  isAuthenticated: boolean;
}

export default function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <nav class="navbar">
      <div class="navbar-content">
        <div class="navbar-left">
          <a href={paths.index()} class="navbar-brand">
            <img src="/assets/image/logo.svg" alt="Noisebridge" class="logo" />
            <span class="site-title">Noisebridge</span>
          </a>
        </div>
        <div class="navbar-right">
          {isAuthenticated ? (
            <>
              <a href={paths.manage()} class="btn-nav mobile-hidden">
                Manage
              </a>
              <a href={paths.signOut()} class="btn-nav">
                Sign Out
              </a>
            </>
          ) : (
            <a href={paths.signIn()} class="btn-nav">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
