import paths from "~/paths";

export interface NavbarProps {
  isAuthenticated: boolean;
}

export default function Navbar({ isAuthenticated }: NavbarProps) {
  return (
    <nav aria-label="Main navigation" style="padding: 10px 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center;">
          <a href={paths.index()}>
            <img src="/assets/image/logo.svg" alt="Noisebridge Logo" style="width: 48px; height: 48px;" />
          </a>
          <h1 style="display: inline; margin-left: 10px; font-size: 2.5rem;">Noisebridge</h1>
        </div>
        <div style="display: flex; align-items: center; font-size: 1rem;">
          {isAuthenticated ? (
            <form
              method="post"
              action={paths.signOut()}
              style="display: inline; margin: 0;"
            >
              <button type="submit" style="font-size: 1rem;">Sign Out</button>
            </form>
          ) : (
            <a href={paths.signIn()} style="font-size: 1.25rem; color: blue;">Sign In</a>
          )}
        </div>
      </div>
    </nav>
  );
}
