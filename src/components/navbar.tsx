import paths from "~/lib/paths";

export interface NavbarProps {
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function Navbar({ isAuthenticated, csrfToken }: NavbarProps) {
  return (
    <nav class="navbar" aria-label="Main navigation">
      <div class="navbar-content">
        <a href={paths.index()} class="brand">
          <img
            src={paths.assetWithHash("image/logo.svg")}
            alt="Noisebridge logo"
            class="brand-logo"
          />
          <div class="org">NOISEBRIDGE</div>
        </a>
        <div class="nav-links">
          <a href={paths.qrEditor()} class="hide-mobile">
            QR Editor
          </a>
          {isAuthenticated ? (
            <>
              <a href={paths.manage()}>Manage</a>
              <form
                method="POST"
                action={paths.signOut()}
                class="sign-out-form"
              >
                <input type="hidden" name="_csrf" value={csrfToken} />
                <button type="submit" class="signin">
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <a href={paths.signIn()} class="signin">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
