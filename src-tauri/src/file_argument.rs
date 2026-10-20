use std::ffi::OsString;
use std::path::PathBuf;

// Windows y Linux entregan las asociaciones de archivo como argumentos del
// proceso. macOS usa RunEvent::Opened. Mantener este análisis separado permite
// fijar el contrato sin arrancar GTK ni una ventana en las pruebas.
pub fn first_local_file_argument(
    args: impl IntoIterator<Item = OsString>,
) -> Option<String> {
    args.into_iter().skip(1).find_map(|raw| {
        let value = raw.to_string_lossy();
        if value.starts_with('-') || value.contains("://") {
            return None;
        }
        Some(PathBuf::from(raw).to_string_lossy().into_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::first_local_file_argument;
    use std::ffi::OsString;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn takes_the_first_plain_file_path() {
        assert_eq!(
            first_local_file_argument(args(&["luca", "/tmp/archivo con espacios.md"])),
            Some("/tmp/archivo con espacios.md".into())
        );
    }

    #[test]
    fn ignores_flags_and_non_file_urls() {
        assert_eq!(
            first_local_file_argument(args(&[
                "luca",
                "--verbose",
                "https://example.test/no-es-un-archivo",
                "/tmp/pagina.md",
            ])),
            Some("/tmp/pagina.md".into())
        );
    }

    #[test]
    fn returns_none_without_a_local_path() {
        assert_eq!(
            first_local_file_argument(args(&["luca", "--verbose"])),
            None
        );
    }
}
