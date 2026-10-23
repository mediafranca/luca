// El comando `luca` en la terminal.
//
// Qué instalador deja el comando disponible y cuál no:
//   - .deb y .rpm instalan /usr/bin/luca, que ya está en el PATH.
//   - El .msi añade su carpeta al PATH (tabla Environment de WiX).
//   - El .dmg de macOS y el AppImage de Linux no instalan nada fuera de su
//     bundle, así que ahí el comando no existe hasta que alguien lo enlaza.
//
// Para esos dos casos Luca ofrece hacer el enlace él mismo, como hacen VS Code
// o Sublime. Escribe un único symlink en una carpeta que YA esté en el PATH del
// autor y en la que pueda escribir sin privilegios: nunca pide sudo, nunca
// toca el PATH y nunca pisa un archivo que no haya puesto él.

use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case", tag = "state", content = "path")]
pub enum LinkState {
    /// El propio ejecutable ya está en una carpeta del PATH (.deb, .rpm, .msi).
    OnPath(String),
    /// Hay un enlace nuestro: apunta a este ejecutable.
    Linked(String),
    /// Hay algo ajeno con ese nombre. No se toca.
    Occupied(String),
    /// No hay comando y sí hay dónde ponerlo.
    Missing,
    /// No hay ninguna carpeta del PATH escribible: no podemos hacer nada útil.
    NoCandidates,
}

/// Carpetas del PATH donde se puede escribir sin privilegios, en el orden en
/// que aparecen en el PATH. Sólo rutas absolutas y existentes: una entrada
/// relativa del PATH no es un sitio donde instalar nada.
pub fn candidate_dirs(path_var: &str, is_writable: &dyn Fn(&Path) -> bool) -> Vec<PathBuf> {
    let mut seen: Vec<PathBuf> = Vec::new();
    for entry in path_var.split(':') {
        if entry.is_empty() {
            continue;
        }
        let dir = PathBuf::from(entry);
        if !dir.is_absolute() || seen.contains(&dir) || !is_writable(&dir) {
            continue;
        }
        seen.push(dir);
    }
    seen
}

/// Qué hay hoy en `dir/luca`, sabiendo cuál es nuestro ejecutable.
pub fn entry_state(
    dir: &Path,
    exe: &Path,
    resolve: &dyn Fn(&Path) -> Option<PathBuf>,
) -> LinkState {
    let target = dir.join("luca");
    match resolve(&target) {
        None => LinkState::Missing,
        Some(destination) if destination == exe => LinkState::Linked(target.display().to_string()),
        Some(_) => LinkState::Occupied(target.display().to_string()),
    }
}

/// El estado completo: si el ejecutable ya vive en el PATH no hay nada que
/// ofrecer; si no, se mira cada candidata y gana la primera que diga algo.
pub fn link_state(
    exe: &Path,
    candidates: &[PathBuf],
    resolve: &dyn Fn(&Path) -> Option<PathBuf>,
) -> LinkState {
    if let Some(parent) = exe.parent() {
        if candidates.iter().any(|dir| dir == parent) {
            return LinkState::OnPath(exe.display().to_string());
        }
    }
    for dir in candidates {
        match entry_state(dir, exe, resolve) {
            LinkState::Missing => continue,
            found => return found,
        }
    }
    if candidates.is_empty() {
        LinkState::NoCandidates
    } else {
        LinkState::Missing
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn writable_all(_: &Path) -> bool {
        true
    }

    #[test]
    fn solo_carpetas_absolutas_sin_repetir() {
        let dirs = candidate_dirs(
            "/opt/homebrew/bin::rel/bin:/opt/homebrew/bin:/x",
            &writable_all,
        );
        assert_eq!(
            dirs,
            vec![PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/x")]
        );
    }

    #[test]
    fn una_carpeta_sin_permiso_no_es_candidata() {
        let solo_local = |dir: &Path| dir.starts_with("/home");
        let dirs = candidate_dirs("/usr/bin:/home/h/.local/bin", &solo_local);
        assert_eq!(dirs, vec![PathBuf::from("/home/h/.local/bin")]);
    }

    #[test]
    fn un_ejecutable_ya_en_el_path_no_necesita_enlace() {
        let exe = PathBuf::from("/usr/bin/luca");
        let dirs = vec![PathBuf::from("/usr/bin")];
        let estado = link_state(&exe, &dirs, &|_| None);
        assert_eq!(estado, LinkState::OnPath("/usr/bin/luca".into()));
    }

    #[test]
    fn reconoce_su_propio_enlace_y_respeta_el_ajeno() {
        let exe = PathBuf::from("/Applications/Luca.app/Contents/MacOS/luca");
        let dirs = vec![PathBuf::from("/opt/homebrew/bin")];

        let nuestro = |_: &Path| Some(exe.clone());
        assert_eq!(
            link_state(&exe, &dirs, &nuestro),
            LinkState::Linked("/opt/homebrew/bin/luca".into())
        );

        // Un `luca` de otro no se pisa ni se cuenta como instalado.
        let ajeno = |_: &Path| Some(PathBuf::from("/otra/cosa/luca"));
        assert_eq!(
            link_state(&exe, &dirs, &ajeno),
            LinkState::Occupied("/opt/homebrew/bin/luca".into())
        );
    }

    #[test]
    fn sin_carpetas_escribibles_no_se_ofrece_nada() {
        let exe = PathBuf::from("/Applications/Luca.app/Contents/MacOS/luca");
        assert_eq!(link_state(&exe, &[], &|_| None), LinkState::NoCandidates);
    }

    #[test]
    fn la_primera_candidata_libre_deja_el_estado_en_missing() {
        let exe = PathBuf::from("/Applications/Luca.app/Contents/MacOS/luca");
        let dirs = vec![PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/x")];
        assert_eq!(link_state(&exe, &dirs, &|_| None), LinkState::Missing);
    }
}
