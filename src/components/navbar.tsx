import paths from "~/paths";

export interface NavbarProps {
  isAuthenticated: boolean;
}

export function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <nav class="navbar" aria-label="Main navigation">
      <div class="navbar-content">
        <div class="navbar-left">
          <a href={paths.index()} class="navbar-brand">
            <img src="/assets/image/logo.svg" alt="Logo" class="logo" />
            <span class="site-title">Noisebridge</span>
          </a>
        </div>
        <div class="navbar-right">
          <a
            href={paths.qrEditor()}
            class="btn-nav btn-nav-icon"
            aria-label="QR Code Editor"
          >
            <img src="/assets/image/qr-code.svg" alt="" class="nav-icon" />
          </a>
          {isAuthenticated ? (
            <>
              <a
                href={paths.manage()}
                class="btn-nav btn-nav-subtle mobile-hidden"
              >
                Manage
              </a>
              <form
                method="post"
                action={paths.signOut()}
                class="sign-out-form"
              >
                <button type="submit" class="btn-nav btn-nav-filled">
                  Sign Out
                </button>
              </form>
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
