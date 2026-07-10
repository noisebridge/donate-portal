{
  description = "Noisebridge donation portal development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      bunSources = {
        aarch64-darwin = {
          name = "bun-darwin-aarch64.zip";
          hash = "sha256-2LliIYKK1vl6x6wKt+lYcjQa92MAHogD6CZ2UsJlJiA=";
        };
        aarch64-linux = {
          name = "bun-linux-aarch64.zip";
          hash = "sha256-on/7Y6gxA3WDbg1vZorhf6jY0YuIw3yCHGUzGXOhmjs=";
        };
        x86_64-darwin = {
          name = "bun-darwin-x64-baseline.zip";
          hash = "sha256-PjWtb1OXGpg0v55nhuKt9ytfGSHMmpxf3gc9KXKUQHY=";
        };
        x86_64-linux = {
          name = "bun-linux-x64.zip";
          hash = "sha256-lR7iruhV8IWVruxiJSJqKY0/6oOj3NZGXAnLzN9+hI8=";
        };
      };
      biomeSources = {
        aarch64-linux = {
          package = "cli-linux-arm64";
          hash = "sha256-SJaCywl5LFNjIBgA4AaTsNIGY2w362A9Xtc6UUH1trQ=";
        };
        x86_64-linux = {
          package = "cli-linux-x64";
          hash = "sha256-Ut1eugSpYM5kfaOcfRJ3HQNgaYTZxwsfTXRRVz7YvCw=";
        };
      };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          source = bunSources.${system};
          bun = pkgs.bun.overrideAttrs {
            version = "1.3.14";
            src = pkgs.fetchurl {
              url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/${source.name}";
              inherit (source) hash;
            };
          };
          biome =
            let
              biomeSource = biomeSources.${system};
            in
            pkgs.stdenvNoCC.mkDerivation {
              pname = "biome";
              version = "2.5.2";
              src = pkgs.fetchurl {
                url = "https://registry.npmjs.org/@biomejs/${biomeSource.package}/-/${biomeSource.package}-2.5.2.tgz";
                inherit (biomeSource) hash;
              };
              sourceRoot = "package";
              nativeBuildInputs = [ pkgs.autoPatchelfHook ];
              buildInputs = [ pkgs.stdenv.cc.cc.lib ];
              installPhase = "install -Dm755 biome $out/bin/biome";
            };
        in
        {
          default = pkgs.mkShell (
            {
              packages =
                [
                  bun
                  pkgs.watchexec
                ]
                ++ pkgs.lib.optional pkgs.stdenv.isLinux biome;
            }
            // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
              BIOME_BINARY = pkgs.lib.getExe' biome "biome";
            }
          );
        }
      );
    };
}
