// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";

export interface NavbarProps {
  isAuthenticated: boolean;
}

export default function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <nav class="navbar">
      <div class="navbar-content">
        <div class="navbar-left">
          <a href="/" class="navbar-brand">
            <img src="/assets/image/logo.svg" alt="Noisebridge" class="logo" />
            <span class="site-title">Noisebridge</span>
          </a>
        </div>
        <div class="navbar-right">
          {isAuthenticated ? (
            <>
              <a href="/manage" class="btn-nav mobile-hidden">
                Manage
              </a>
              <a href="/auth/signout" class="btn-nav">
                Sign Out
              </a>
            </>
          ) : (
            <a href="/auth" class="btn-nav">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
