import paths from "~/paths";

export interface NavbarProps {
  isAuthenticated: boolean;
}

export function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <nav class="navbar" aria-label="Main navigation">
      <div class="navbar-content">
        <a href={paths.index()} class="brand">
          <div class="mark">N</div>
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
                method="post"
                action={paths.signOut()}
                class="sign-out-form"
              >
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
